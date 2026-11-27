'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface Props {
  source: File | string
  portrait: boolean
  busy: boolean
  maxBytes: number
  onSave: (file: File) => Promise<void>
  onCancel: () => void
}

export function ImageFramingEditor({ source, portrait, busy, maxBytes, onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement>()
  const [failed, setFailed] = useState(false)
  const [ratio, setRatio] = useState(portrait ? '0.8' : 'original')
  const [zoom, setZoom] = useState(1)
  const [x, setX] = useState(50)
  const [y, setY] = useState(50)
  const [encoding, setEncoding] = useState(false)
  const locked = busy || encoding

  useEffect(() => {
    const img = new Image()
    const local = typeof source !== 'string'
    const url = local ? URL.createObjectURL(source) : source
    if (!local) img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.onerror = () => setFailed(true)
    img.src = url
    return () => {
      img.onload = img.onerror = null
      if (local) URL.revokeObjectURL(url)
    }
  }, [source])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!image || !canvas) return
    const w = image.naturalWidth
    const h = image.naturalHeight
    const aspect = ratio === 'original' ? w / h : Number(ratio)
    const width = Math.min(w, h * aspect) / zoom
    const height = width / aspect
    const scale = Math.min(1, 1280 / Math.max(width, height))
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    canvas.getContext('2d')?.drawImage(image, (w - width) * x / 100, (h - height) * y / 100,
      width, height, 0, 0, canvas.width, canvas.height)
  }, [image, ratio, zoom, x, y])

  async function save() {
    const canvas = canvasRef.current
    if (!image || !canvas || locked) return
    setEncoding(true)
    try {
      if (source instanceof File && ratio === 'original' && zoom === 1) {
        await onSave(source)
        return
      }
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.9))
      if (!blob || blob.size > maxBytes) throw new Error('تعذر تجهيز الصورة بالحجم المطلوب')
      await onSave(new File([blob], 'framed-image.' + (blob.type === 'image/webp' ? 'webp' : 'png'), { type: blob.type }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ الصورة')
    } finally {
      setEncoding(false)
    }
  }

  return <fieldset disabled={locked} className="space-y-3 rounded-xl border border-sky-200 p-3 text-xs">
    <legend className="px-1 font-bold">ضبط الصورة</legend>
    <canvas ref={canvasRef} hidden={!image} className="mx-auto max-h-60 max-w-full rounded-lg" aria-label="معاينة القص" />
    {!image && <p role="status">{failed ? 'تعذر فتح الصورة للتعديل. اختار الملف من جهازك.' : 'جارٍ تجهيز المعاينة…'}</p>}
    <label className="flex items-center gap-2">شكل الصورة
      <select value={ratio} onChange={e => setRatio(e.target.value)}>
        <option value="original">المقاس الأصلي</option><option value="0.8">بورتريه</option>
        <option value="1">مربع</option><option value="1.7777777778">عريض</option>
      </select>
    </label>
    {([{ label: 'التكبير', value: zoom, set: setZoom, min: 1, max: 4, step: 0.05 },
       { label: 'الموضع الأفقي', value: x, set: setX, min: 0, max: 100, step: 1 },
       { label: 'الموضع الرأسي', value: y, set: setY, min: 0, max: 100, step: 1 }]).map(control =>
      <label key={control.label} className="flex items-center gap-2">{control.label}
        <input type="range" dir="ltr" className="flex-1" min={control.min} max={control.max} step={control.step}
          value={control.value} onChange={e => control.set(Number(e.target.value))} />
      </label>)}
    <div className="flex gap-4">
      <button type="button" className="rounded-lg bg-sky-600 px-3 py-2 font-bold text-white disabled:opacity-50" disabled={!image || locked} onClick={save}>{locked ? 'جارٍ الحفظ…' : 'اعتماد الصورة'}</button>
      <button type="button" onClick={onCancel}>إلغاء</button>
    </div>
  </fieldset>
}
