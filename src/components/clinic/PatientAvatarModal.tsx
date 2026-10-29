'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Camera,
  Trash2,
  X,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  AlertCircle,
  UploadCloud,
  Move,
  Maximize2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  validateImageFile,
  cropImageToBlob,
  MAX_AVATAR_SIZE_BYTES,
  MAX_AVATAR_SIZE_ERROR
} from '@/lib/avatarUpload'

interface PatientAvatarModalProps {
  isOpen: boolean
  onClose: () => void
  currentAvatarUrl?: string
  patientName: string
  onSaveAvatar: (blob: Blob) => Promise<void>
  onDeleteAvatar?: () => Promise<void>
}

// Diameter in pixels of the preview circle in the modal
const CIRCLE_DIAMETER = 224

export function PatientAvatarModal({
  isOpen,
  onClose,
  currentAvatarUrl,
  patientName,
  onSaveAvatar,
  onDeleteAvatar
}: PatientAvatarModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [zoom, setZoom] = useState<number>(1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)

  const imgRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dragStartRef = useRef<{ clientX: number; clientY: number; startPanX: number; startPanY: number }>({
    clientX: 0,
    clientY: 0,
    startPanX: 0,
    startPanY: 0
  })

  // Reset state when opening or closing
  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null)
      setPreviewSrc(null)
      setNaturalSize({ width: 0, height: 0 })
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setIsDragging(false)
      setIsSubmitting(false)
      setIsDeleting(false)
    }
  }, [isOpen])

  // Compute base scaling to fit/cover the circle diameter
  const { baseWidth, baseHeight, baseScale, maxPanX, maxPanY } = useMemo(() => {
    const nw = naturalSize.width || 1
    const nh = naturalSize.height || 1
    const S = CIRCLE_DIAMETER

    // Scale factor so that the image completely covers the circle without letterboxing
    const scale = Math.max(S / nw, S / nh)
    const bw = nw * scale
    const bh = nh * scale

    // At current zoom, the display width and height
    const currentW = bw * zoom
    const currentH = bh * zoom

    // Max pan allowed so image continues to cover the circle
    const maxX = Math.max(0, (currentW - S) / 2)
    const maxY = Math.max(0, (currentH - S) / 2)

    return {
      baseWidth: bw,
      baseHeight: bh,
      baseScale: scale,
      maxPanX: maxX,
      maxPanY: maxY
    }
  }, [naturalSize, zoom])

  // Keep pan within bounds when zoom changes
  useEffect(() => {
    setPan((prev) => ({
      x: Math.max(-maxPanX, Math.min(maxPanX, prev.x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, prev.y))
    }))
  }, [maxPanX, maxPanY])

  if (!isOpen) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 1. Validate file (Size <= 2MB, MIME type, Magic Bytes)
    const validation = await validateImageFile(file)
    if (!validation.valid) {
      toast.error(validation.error || 'ملف الصورة غير صالح')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // 2. Read file and load natural dimensions
    const reader = new FileReader()
    reader.onload = (event) => {
      const src = event.target?.result as string
      const tempImg = new Image()
      tempImg.onload = () => {
        setNaturalSize({ width: tempImg.naturalWidth, height: tempImg.naturalHeight })
        setPreviewSrc(src)
        setSelectedFile(file)
        setZoom(1)
        setPan({ x: 0, y: 0 })
      }
      tempImg.src = src
    }
    reader.readAsDataURL(file)
  }

  // Pointer drag events for desktop mouse + mobile touch
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    e.preventDefault()
    const dx = e.clientX - dragStartRef.current.clientX
    const dy = e.clientY - dragStartRef.current.clientY

    const nextX = dragStartRef.current.startPanX + dx
    const nextY = dragStartRef.current.startPanY + dy

    setPan({
      x: Math.max(-maxPanX, Math.min(maxPanX, nextX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, nextY))
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }

  const handleConfirmSave = async () => {
    if (!selectedFile || !previewSrc || !naturalSize.width) return

    setIsSubmitting(true)
    try {
      const img = imgRef.current
      if (!img) throw new Error('Image element not found')

      const nw = naturalSize.width
      const nh = naturalSize.height
      const S = CIRCLE_DIAMETER
      const totalScale = baseScale * zoom

      // Exact crop rectangle in natural image pixels
      const cropSize = S / totalScale
      const rawCropX = (nw - cropSize) / 2 - pan.x / totalScale
      const rawCropY = (nh - cropSize) / 2 - pan.y / totalScale

      const cropX = Math.max(0, Math.min(nw - cropSize, rawCropX))
      const cropY = Math.max(0, Math.min(nh - cropSize, rawCropY))

      const blob = await cropImageToBlob(
        img,
        { x: cropX, y: cropY, size: cropSize },
        420
      )

      // Strict 2MB limit check
      if (blob.size > MAX_AVATAR_SIZE_BYTES) {
        toast.error(MAX_AVATAR_SIZE_ERROR)
        setIsSubmitting(false)
        return
      }

      await onSaveAvatar(blob)
      onClose()
    } catch (err: any) {
      console.error('Error saving avatar:', err)
      toast.error('حدث خطأ أثناء حفظ الصورة، يرجى المحاولة ثانيةً')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!onDeleteAvatar) return
    if (!confirm('هل أنت متأكد من رغبتك في حذف صورتك الشخصية والرجوع للحرف الأول؟')) return

    setIsDeleting(true)
    try {
      await onDeleteAvatar()
      onClose()
    } catch (err) {
      toast.error('تعذر حذف الصورة')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleResetFraming = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md bg-white dark:bg-[#081526] rounded-3xl p-6 shadow-2xl border border-sky-100 dark:border-slate-800 space-y-5 my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                الصورة الشخصية
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                الحد الأقصى للحجم 2 ميجابايت (JPEG, PNG, WebP)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isDeleting}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Preview / Interactive Circular Cropper Area */}
        <div className="flex flex-col items-center justify-center">
          {previewSrc ? (
            <div className="space-y-4 w-full">
              {/* Circular Viewport with drag-to-reposition */}
              <div className="flex flex-col items-center">
                <div
                  ref={containerRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  style={{ width: `${CIRCLE_DIAMETER}px`, height: `${CIRCLE_DIAMETER}px` }}
                  className={`relative rounded-full overflow-hidden border-4 border-sky-500 shadow-2xl bg-slate-950 flex items-center justify-center select-none touch-none ${
                    isDragging ? 'cursor-grabbing ring-4 ring-sky-400/30' : 'cursor-grab'
                  }`}
                  title="اسحب بالماوس أو الإصبع لتحريك الصورة وضبط الموضع داخل الدائرة"
                >
                  <img
                    ref={imgRef}
                    src={previewSrc}
                    alt="معاينة الصورة"
                    draggable={false}
                    className="max-w-none transition-transform duration-75 select-none pointer-events-none"
                    style={{
                      width: `${baseWidth * zoom}px`,
                      height: `${baseHeight * zoom}px`,
                      transform: `translate(${pan.x}px, ${pan.y}px)`
                    }}
                  />

                  {/* Subtle target circle overlay */}
                  <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                  <Move className="w-3.5 h-3.5 text-sky-500" />
                  <span>اسحب الصورة لتحريكها وتوسيط وجهك داخل الدائرة</span>
                </div>
              </div>

              {/* Zoom Control Slider & Buttons */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl space-y-2 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))}
                    className="flex items-center gap-1 hover:text-sky-600 cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                    <span>تصغير</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sky-600 dark:text-sky-400 font-extrabold text-xs">
                      {Math.round(zoom * 100)}%
                    </span>
                    {(zoom > 1 || pan.x !== 0 || pan.y !== 0) && (
                      <button
                        type="button"
                        onClick={handleResetFraming}
                        className="text-[10px] text-slate-400 hover:text-sky-500 underline cursor-pointer"
                        title="إعادة ضبط الموضع والتكبير"
                      >
                        إعادة ضبط
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
                    className="flex items-center gap-1 hover:text-sky-600 cursor-pointer"
                  >
                    <span>تكبير</span>
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  dir="ltr"
                  className="w-full accent-sky-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* File details & Change File CTA */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                {selectedFile && (
                  <div>
                    <span>حجم الملف: </span>
                    <strong className="text-slate-700 dark:text-slate-200 font-mono">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} ميجابايت
                    </strong>
                    <span> / الحد الأقصى 2.0 ميجابايت</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>اختيار صورة أخرى</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 w-full text-center">
              {/* Current Avatar or Initial */}
              <div className="relative w-36 h-36 mx-auto rounded-full overflow-hidden border-4 border-dashed border-sky-400/50 bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center shadow-inner">
                {currentAvatarUrl ? (
                  <img
                    src={currentAvatarUrl}
                    alt={patientName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-black text-sky-600 dark:text-sky-400">
                    {patientName.charAt(0) || 'م'}
                  </span>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {currentAvatarUrl ? 'لديك صورة شخصية محفوظة حالياً' : 'لم يتم تعيين صورة شخصية بعد'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  اختر صورة واضحة لوجهك لتسهيل التعرف عليك في العيادة
                </p>
              </div>

              {/* Upload CTA Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-2xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <UploadCloud className="w-4 h-4" />
                <span>اختيار صورة من جهازك (بحد أقصى 2 ميجابايت)</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {previewSrc ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSave}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري رفع وحفظ الصورة...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>حفظ الصورة الشخصية</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setSelectedFile(null)
                  setPreviewSrc(null)
                }}
                className="py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {currentAvatarUrl && onDeleteAvatar && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="flex-1 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>حذف الصورة الحالية</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer text-center"
              >
                إغلاق
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
