import { NextRequest, NextResponse } from 'next/server'
import { readDocument, writeDocument } from '@/lib/server/firebase-rest'
import {
  ApiError, apiFailure, readJson, requireOwner,
} from '@/lib/server/owner-access'

export const dynamic = 'force-dynamic'

/**
 * Only a verified platform owner may read or edit these settings.
 * Never ship API secrets back to the browser: a previous owner dashboard
 * attempted a Firestore client read of system/config, which is forbidden by
 * strict Firestore rules and would expose secrets if those rules were opened.
 */
export async function GET(request: NextRequest) {
  try {
    await requireOwner(request)
    const [config, settings] = await Promise.all([
      readDocument('system/config'),
      readDocument('platformSettings/main'),
    ])
    return NextResponse.json({
      success: true,
      hasGlobalAiKey: typeof config?.globalAiKey === 'string' && config.globalAiKey.length > 0,
      hasResendApiKey: typeof config?.resendApiKey === 'string' && config.resendApiKey.length > 0,
      supportNumbers: Array.isArray(settings?.supportNumbers) ? settings.supportNumbers : [],
      showPackagesInClinics: settings?.showPackagesInClinics === true,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return apiFailure(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const owner = await requireOwner(request)
    const data = await readJson(request, 8192) as Record<string, unknown>
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ApiError(400, 'INVALID_SETTINGS', 'بيانات إعدادات المالك غير صالحة.')
    }
    if (typeof data.globalAiKey !== 'string' || data.globalAiKey.length > 512 ||
        typeof data.resendApiKey !== 'string' || data.resendApiKey.length > 512 ||
        !Array.isArray(data.supportNumbers) || data.supportNumbers.length > 12) {
      throw new ApiError(400, 'INVALID_SETTINGS', 'راجع مفاتيح الخدمات وأرقام الدعم.')
    }
    const supportNumbers = data.supportNumbers.map((item: unknown) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new ApiError(400, 'INVALID_SUPPORT_NUMBER', 'بيانات رقم الدعم غير صحيحة.')
      }
      const entry = item as Record<string, unknown>
      const phone = String(entry.phone || '').trim()
      const label = String(entry.label || '').trim()
      if (!/^[+0-9()\s-]{5,32}$/.test(phone) || label.length > 80 ||
          typeof entry.isActive !== 'boolean') {
        throw new ApiError(400, 'INVALID_SUPPORT_NUMBER', 'راجع أرقام الدعم وحالة تفعيلها.')
      }
      return { phone, label, isActive: entry.isActive }
    })
    const secretChanges: Record<string, string> = {}
    const ai = data.globalAiKey.trim()
    const resend = data.resendApiKey.trim()
    // A blank field retains the existing secret. Never send stored keys back
    // to the browser and never clear them as an accidental side effect.
    if (ai) secretChanges.globalAiKey = ai
    if (resend) secretChanges.resendApiKey = resend
    if (Object.keys(secretChanges).length) {
      await writeDocument('system/config', {
        ...secretChanges,
        secretsUpdatedAt: new Date().toISOString(),
        secretsUpdatedBy: owner.email,
      }, true)
    }
    await writeDocument('platformSettings/main', {
      supportNumbers,
      updatedAt: new Date().toISOString(),
      updatedBy: owner.email,
    }, true)
    return NextResponse.json({ success: true }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    return apiFailure(error)
  }
}
