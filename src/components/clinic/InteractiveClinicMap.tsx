'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  Plus,
  Minus,
  LocateFixed,
  Layers,
  Maximize2,
  Minimize2,
  Navigation,
  MapPin,
  ExternalLink,
  Sparkles
} from 'lucide-react'

export interface InteractiveClinicMapProps {
  lat: number
  lng: number
  clinicName: string
  branchName?: string
  address: string
  directionsUrl: string
  googleMapsUrl?: string
  className?: string
  height?: string
}

declare global {
  interface Window {
    L: any
  }
}

export function InteractiveClinicMap({
  lat,
  lng,
  clinicName,
  branchName,
  address,
  directionsUrl,
  googleMapsUrl,
  className = '',
  height = 'h-72 sm:h-80'
}: InteractiveClinicMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(16)
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const tileLayerRef = useRef<any>(null)

  // Load Leaflet CSS and JS dynamically from CDN
  useEffect(() => {
    let isCancelled = false

    const loadLeafletAssets = async (): Promise<any> => {
      if (typeof window === 'undefined') return null
      if (window.L) return window.L

      // Inject Leaflet CSS if not already present
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
        link.integrity = 'sha512-Zcn6bjR/8RZbLEpLIeOwNtzREBAUnWC//YOTCm09vBp8r14CL7Z4hYsP79g4+AoWIecGoQDQRcQ5xC26Cfl5dQ=='
        link.crossOrigin = ''
        document.head.appendChild(link)
      }

      // Inject Leaflet JS if not already present
      return new Promise((resolve, reject) => {
        if (window.L) return resolve(window.L)

        const existingScript = document.getElementById('leaflet-js') as HTMLScriptElement
        if (existingScript) {
          existingScript.addEventListener('load', () => resolve(window.L))
          existingScript.addEventListener('error', reject)
          return
        }

        const script = document.createElement('script')
        script.id = 'leaflet-js'
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
        script.integrity = 'sha512-BwHfrr4c9kmRkLw6iXFdzcdWV/PGkVgiIyIWLLlTSXznnUo93SxF4PHBIac94lU/IsXX+Q+NczchG0RMBRz0dQ=='
        script.crossOrigin = ''
        script.async = true
        script.onload = () => resolve(window.L)
        script.onerror = () => reject(new Error('Failed to load Leaflet script'))
        document.body.appendChild(script)
      })
    }

    loadLeafletAssets()
      .then((L) => {
        if (isCancelled || !L || !containerRef.current) return

        // Destroy previous map instance if re-initializing
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.remove()
          } catch (e) {}
          mapInstanceRef.current = null
        }

        // Initialize Leaflet Map with smooth mouse wheel zooming enabled
        const map = L.map(containerRef.current, {
          center: [lat, lng],
          zoom: 16,
          minZoom: 6,
          maxZoom: 20,
          scrollWheelZoom: true, // NATIVE MOUSE WHEEL ZOOMING
          smoothWheelZoom: true,
          zoomControl: false, // We use custom Tailwind UI controls
          attributionControl: false
        })

        mapInstanceRef.current = map

        // Street Tiles (Google Maps Street Layer)
        const streetTiles = L.tileLayer(
          'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
          {
            subdomains: ['0', '1', '2', '3'],
            maxZoom: 20
          }
        )

        streetTiles.addTo(map)
        tileLayerRef.current = streetTiles

        // Custom Glowing Pulsing Radar Pin Marker
        const safeTitle = (branchName || clinicName || 'مقر العيادة').replace(/</g, '&lt;')
        const customIcon = L.divIcon({
          className: 'custom-clinic-marker',
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
              <div style="position: absolute; top: 12px; width: 64px; height: 64px; border-radius: 9999px; background: rgba(14, 165, 233, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; pointer-events: none;"></div>
              <div style="position: absolute; top: 20px; width: 48px; height: 48px; border-radius: 9999px; background: rgba(56, 189, 248, 0.45); pointer-events: none;"></div>
              
              <div style="position: relative; z-index: 10; padding: 6px 14px; border-radius: 14px; background: #071529; color: #ffffff; font-size: 11px; font-weight: 800; border: 1.5px solid #38bdf8; box-shadow: 0 10px 25px -5px rgba(0, 102, 220, 0.5); display: flex; items-center; gap: 6px; white-space: nowrap;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 9999px; background: #ef4444; box-shadow: 0 0 8px #ef4444;"></span>
                <span>${safeTitle}</span>
              </div>
              <div style="width: 8px; height: 8px; background: #071529; transform: rotate(45deg); margin-top: -4px; border-right: 1.5px solid #38bdf8; border-bottom: 1.5px solid #38bdf8;"></div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        })

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map)
        markerRef.current = marker

        // Interactive Popup
        const safeAddress = address.replace(/</g, '&lt;')
        const popupContent = `
          <div style="font-family: 'Cairo', sans-serif; text-align: right; padding: 4px; min-width: 190px;">
            <div style="font-weight: 900; font-size: 13px; color: #0284c7; margin-bottom: 4px;">${safeTitle}</div>
            <div style="font-size: 11px; color: #334155; line-height: 1.5; margin-bottom: 8px;">📍 ${safeAddress}</div>
            <a href="${directionsUrl}" target="_blank" rel="noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #0077e6; color: #fff; font-weight: 800; font-size: 11px; padding: 6px 12px; border-radius: 10px; text-decoration: none;">
              <span>ابدأ الملاحة (GPS)</span>
            </a>
          </div>
        `
        marker.bindPopup(popupContent)

        // Track zoom level changes
        map.on('zoomend', () => {
          setCurrentZoom(map.getZoom())
        })

        setIsLoaded(true)
      })
      .catch((err) => {
        console.warn('Could not initialize Leaflet map, falling back to Google embed iframe:', err)
        setLoadError(true)
      })

    return () => {
      isCancelled = true
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove()
        } catch (e) {}
        mapInstanceRef.current = null
      }
    }
  }, [lat, lng, clinicName, branchName, address, directionsUrl])

  // Switch between Street and Satellite layers
  const toggleMapType = useCallback(() => {
    if (!window.L || !mapInstanceRef.current) return
    const map = mapInstanceRef.current
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current)
    }

    const nextType = mapType === 'street' ? 'satellite' : 'street'
    const newLayer =
      nextType === 'satellite'
        ? window.L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            subdomains: ['0', '1', '2', '3'],
            maxZoom: 20
          })
        : window.L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            subdomains: ['0', '1', '2', '3'],
            maxZoom: 20
          })

    newLayer.addTo(map)
    tileLayerRef.current = newLayer
    setMapType(nextType)
  }, [mapType])

  // Recenter map on the clinic coordinates
  const handleRecenter = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 16, { animate: true })
      if (markerRef.current) {
        markerRef.current.openPopup()
      }
    }
  }, [lat, lng])

  // Zoom In / Out Handlers
  const handleZoomIn = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn()
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut()
    }
  }, [])

  // If Leaflet fails, gracefully render Google Maps Embed iframe with EXACT coordinates
  if (loadError) {
    const fallbackIframeUrl = `https://maps.google.com/maps?q=${lat},${lng}&t=&z=16&ie=UTF8&iwloc=&output=embed`
    return (
      <div className={`relative w-full ${height} rounded-[24px] overflow-hidden bg-slate-950 ${className}`}>
        <iframe
          title={`خريطة موقع ${clinicName}`}
          src={fallbackIframeUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          className="w-full h-full"
        />
      </div>
    )
  }

  return (
    <div
      className={`relative w-full ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen rounded-none' : `${height} rounded-[24px]`
      } overflow-hidden bg-slate-950 shadow-inner select-none ${className}`}
    >
      {/* Map DOM Container */}
      <div ref={containerRef} className="w-full h-full z-0 cursor-grab active:cursor-grabbing" />

      {/* Loading Skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 z-10 text-white">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-sky-500/20 animate-ping absolute" />
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0066dc] to-[#00b4d8] flex items-center justify-center shadow-lg shadow-sky-500/30">
              <MapPin className="w-5 h-5 text-white animate-bounce" />
            </div>
          </div>
          <span className="text-xs font-bold text-sky-200">جاري تحميل خريطة العيادة الذكية...</span>
        </div>
      )}

      {/* Floating Mouse Wheel Zoom & Navigation Tip Pill */}
      <div className="absolute top-3 right-3 z-20 pointer-events-none hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-white/15 text-[11px] font-bold text-white shadow-lg">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>تحكم بالسكرول (بكرة الماوس) للتكبير 🖱️</span>
      </div>

      {/* Floating Floating Map Action Controls (Top Left) */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5">
        {/* Zoom In (+) */}
        <button
          type="button"
          onClick={handleZoomIn}
          title="تكبير الخريطة"
          className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-sky-600 text-white border border-white/15 backdrop-blur-md flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Zoom Out (-) */}
        <button
          type="button"
          onClick={handleZoomOut}
          title="تصغير الخريطة"
          className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-sky-600 text-white border border-white/15 backdrop-blur-md flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Recenter Button */}
        <button
          type="button"
          onClick={handleRecenter}
          title="إعادة التمركز على موقع العيادة"
          className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-sky-600 text-sky-400 hover:text-white border border-white/15 backdrop-blur-md flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <LocateFixed className="w-4 h-4" />
        </button>

        {/* Satellite / Street Switcher */}
        <button
          type="button"
          onClick={toggleMapType}
          title={mapType === 'street' ? 'التحويل للقمر الصناعي' : 'التحويل للخريطة العادية'}
          className={`w-9 h-9 rounded-xl border border-white/15 backdrop-blur-md flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer ${
            mapType === 'satellite'
              ? 'bg-amber-500 text-slate-950 font-black'
              : 'bg-slate-900/90 hover:bg-sky-600 text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={() => {
            setIsFullscreen(!isFullscreen)
            setTimeout(() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.invalidateSize()
              }
            }, 250)
          }}
          title={isFullscreen ? 'تصغير الشاشة' : 'تكبير الشاشة بالكامل'}
          className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-sky-600 text-white border border-white/15 backdrop-blur-md flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Floating Bottom Quick Bar: Direct GPS Directions & External App */}
      <div className="absolute bottom-3 right-3 left-3 z-20 flex items-center justify-between gap-2 pointer-events-auto">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0066dc] via-[#007fe8] to-[#00b4d8] text-white font-black text-xs flex items-center gap-2 shadow-xl hover:shadow-sky-500/25 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
        >
          <Navigation className="w-4 h-4 text-white animate-pulse" />
          <span>ابدأ الملاحة خطوة بخطوة (GPS)</span>
        </a>

        {googleMapsUrl && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="py-2.5 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-sky-400 hover:text-sky-300 font-bold text-xs border border-white/15 backdrop-blur-md flex items-center gap-1.5 shadow-lg transition-all cursor-pointer shrink-0"
          >
            <span>فتح في تطبيق Google Maps</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}
