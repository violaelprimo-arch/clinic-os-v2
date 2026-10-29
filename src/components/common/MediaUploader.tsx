'use client'

import React, { useState, useRef } from 'react'
import {
  UploadCloud,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Image as ImageIcon,
  Trash2,
  ExternalLink
} from 'lucide-react'
import { validateMediaFile, uploadMediaToStorage, deleteMediaFromStorage } from '@/lib/mediaUpload'
import { toast } from 'sonner'

export interface MediaUploaderProps {
  value: string
  onChange: (url: string) => void
  folder?: string
  label?: string
  hint?: string
  maxSizeMB?: number
  aspectRatio?: 'video' | 'square' | 'wide' | 'auto'
  className?: string
}

export function MediaUploader({
  value,
  onChange,
  folder = 'general',
  label,
  hint,
  maxSizeMB = 5,
  aspectRatio = 'auto',
  className = ''
}: MediaUploaderProps) {
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const maxBytes = maxSizeMB * 1024 * 1024

  const handleProcessFile = async (file: File) => {
    // 1. Validate
    const validation = await validateMediaFile(file, maxBytes)
    if (!validation.valid) {
      toast.error(validation.error || 'ملف الصورة غير صالح')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // 2. Upload
    setIsUploading(true)
    try {
      const downloadUrl = await uploadMediaToStorage(file, folder)
      onChange(downloadUrl)
      toast.success('تم رفع الصورة بنجاح! 📸')
    } catch (err: any) {
      console.error('Media upload error:', err)
      toast.error(err?.message || 'تعذر رفع الصورة، يرجى المحاولة ثانيةً')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleProcessFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleProcessFile(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('هل أنت متأكد من حذف هذه الصورة؟')) return
    const prev = value
    onChange('')
    if (prev) {
      await deleteMediaFromStorage(prev)
    }
    toast.success('تمت إزالة الصورة')
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {value ? (
        /* Image Preview Box */
        <div className="relative rounded-2xl border border-sky-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-3 group overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="relative w-24 h-20 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
              <img
                src={value}
                alt="معاينة الصورة"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="flex-1 min-w-0 space-y-1 text-right">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate" dir="ltr">
                {value.split('/').pop()?.slice(0, 35) || 'image'}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>تم حفظ الصورة على السيرفر</span>
              </span>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>استبدال من جهازك</span>
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isUploading}
                  className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          </div>

          {isUploading && (
            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center gap-2 text-white text-xs font-bold rounded-2xl">
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              <span>جاري استبدال ورفع الصورة...</span>
            </div>
          )}
        </div>
      ) : (
        /* Empty Upload Drop-zone */
        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all select-none ${
            isDragging
              ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/20'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-sky-50/50 dark:hover:bg-slate-800/50 hover:border-sky-300'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 text-sky-600 dark:text-sky-400">
              <Loader2 className="w-7 h-7 animate-spin" />
              <span className="text-xs font-bold">جاري رفع وحفظ الصورة...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  اضغط لاختيار صورة من جهازك، أو اسحب الملف هنا
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  الصيغ المدعومة: JPEG, PNG, WebP (بحد أقصى {maxSizeMB} ميجابايت)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {hint && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
          {hint}
        </p>
      )}
    </div>
  )
}
