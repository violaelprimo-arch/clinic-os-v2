'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  Map as MapIcon, Satellite, Layers, ZoomIn, ZoomOut, RotateCcw,
  Maximize2, Minimize2, Users, MapPin, Sparkles, Navigation
} from 'lucide-react'
import type { AreaDataPoint } from './GeographicDistributionCard'

// Major Egyptian Geographic Reference Landmarks for rich context
const MAJOR_EGYPT_LANDMARKS = [
  { id: 'ref_cairo_center', nameAr: 'وسط البلد / التحرير', nameEn: 'Downtown Cairo', lat: 30.0444, lng: 31.2357 },
  { id: 'ref_shubra', nameAr: 'شبرا الخيمة', nameEn: 'Shubra El Kheima', lat: 30.1286, lng: 31.2422 },
  { id: 'ref_nasr_city', nameAr: 'مدينة نصر', nameEn: 'Nasr City', lat: 30.052, lng: 31.342 },
  { id: 'ref_heliopolis', nameAr: 'مصر الجديدة', nameEn: 'Heliopolis', lat: 30.088, lng: 31.328 },
  { id: 'ref_new_cairo', nameAr: 'التجمع الخامس', nameEn: 'New Cairo 5th Settlement', lat: 30.012, lng: 31.491 },
  { id: 'ref_dokki', nameAr: 'الدقي والمهندسين', nameEn: 'Dokki & Mohandessin', lat: 30.038, lng: 31.212 },
  { id: 'ref_maadi', nameAr: 'المعادي', nameEn: 'Maadi', lat: 29.96, lng: 31.258 },
  { id: 'ref_october', nameAr: '6 أكتوبر والشيخ زايد', nameEn: '6th of October & Zayed', lat: 29.972, lng: 30.942 },
  { id: 'ref_alex_center', nameAr: 'الإسكندرية (محطة الرمل)', nameEn: 'Alexandria', lat: 31.2001, lng: 29.9187 },
  { id: 'ref_tanta', nameAr: 'طنطا (الغربية)', nameEn: 'Tanta', lat: 30.7865, lng: 31.0004 },
  { id: 'ref_mansoura', nameAr: 'المنصورة (الدقهلية)', nameEn: 'Mansoura', lat: 31.0409, lng: 31.3785 },
  { id: 'ref_zagazig', nameAr: 'الزقازيق (الشرقية)', nameEn: 'Zagazig', lat: 30.5877, lng: 31.5020 }
]

export interface RealInteractiveMapProps {
  areaData: AreaDataPoint[]
  selectedAreaId: string | null
  onSelectArea: (areaId: string) => void
  isRtl?: boolean
  language?: string
}

export default function RealInteractiveMap({
  areaData,
  selectedAreaId,
  onSelectArea,
  isRtl = true,
  language = 'ar'
}: RealInteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const currentTileLayerRef = useRef<any>(null)
  const markerMapRef = useRef<Map<string, any>>(new Map())

  const [mapLayer, setMapLayer] = useState<'google_streets' | 'google_satellite' | 'carto_voyager'>('google_streets')
  const [currentZoom, setCurrentZoom] = useState<number>(7)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMapLoaded, setIsMapLoaded] = useState(false)

  // 1. Bulletproof page scroll prevention on mouse wheel
  useEffect(() => {
    const el = mapContainerRef.current
    if (!el) return

    const handleWheelCapture = (e: WheelEvent) => {
      // Prevents the browser window from scrolling vertically when hovering over the map
      e.preventDefault()
      e.stopPropagation()
    }

    el.addEventListener('wheel', handleWheelCapture, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheelCapture)
    }
  }, [])

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined') return
    let isCancelled = false

    const initMap = async () => {
      try {
        const L = (await import('leaflet')).default
        // Import Leaflet stylesheet dynamically
        await import('leaflet/dist/leaflet.css')

        if (isCancelled || !mapContainerRef.current) return

        // If map was already created, destroy it first
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove()
          mapInstanceRef.current = null
        }

        // Determine initial center
        const defaultCenter: [number, number] = [30.0444, 31.2357] // Cairo
        const initialZoom = 7

        const map = L.map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: initialZoom,
          minZoom: 5,
          maxZoom: 18,
          zoomControl: false, // We render modern custom controls
          attributionControl: true,
          scrollWheelZoom: true
        })

        // Tile layers configurations
        const getTileUrl = (type: string) => {
          if (type === 'google_satellite') {
            return 'https://mt{s}.google.com/vt/lyrs=y&hl=ar&x={x}&y={y}&z={z}'
          }
          if (type === 'carto_voyager') {
            return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
          }
          // Default Google Maps Roadmap with Arabic labels & street names
          return 'https://mt{s}.google.com/vt/lyrs=m&hl=ar&x={x}&y={y}&z={z}'
        }

        const tileLayer = L.tileLayer(getTileUrl(mapLayer), {
          subdomains: mapLayer === 'carto_voyager' ? ['a', 'b', 'c', 'd'] : ['0', '1', '2', '3'],
          attribution: mapLayer === 'carto_voyager' ? '&copy; OpenStreetMap &copy; CARTO' : '&copy; Google Maps',
          maxZoom: 18
        }).addTo(map)

        currentTileLayerRef.current = tileLayer
        markersLayerRef.current = L.layerGroup().addTo(map)
        mapInstanceRef.current = map

        map.on('zoomend', () => {
          setCurrentZoom(map.getZoom())
        })

        setIsMapLoaded(true)
      } catch (err) {
        console.error('Failed to initialize Leaflet Map:', err)
      }
    }

    initMap()

    return () => {
      isCancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // 3. Update Tile Layer on Layer Switch
  useEffect(() => {
    if (!mapInstanceRef.current || !currentTileLayerRef.current) return
    const L = (window as any).L || (globalThis as any).L

    import('leaflet').then((module) => {
      const Leaflet = module.default
      if (!mapInstanceRef.current) return

      if (currentTileLayerRef.current) {
        mapInstanceRef.current.removeLayer(currentTileLayerRef.current)
      }

      let newUrl = 'https://mt{s}.google.com/vt/lyrs=m&hl=ar&x={x}&y={y}&z={z}'
      let subdomains = ['0', '1', '2', '3']
      let attribution = '&copy; Google Maps'

      if (mapLayer === 'google_satellite') {
        newUrl = 'https://mt{s}.google.com/vt/lyrs=y&hl=ar&x={x}&y={y}&z={z}'
      } else if (mapLayer === 'carto_voyager') {
        newUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
        subdomains = ['a', 'b', 'c', 'd']
        attribution = '&copy; OpenStreetMap &copy; CARTO'
      }

      const newLayer = Leaflet.tileLayer(newUrl, {
        subdomains,
        attribution,
        maxZoom: 18
      }).addTo(mapInstanceRef.current)

      currentTileLayerRef.current = newLayer
    })
  }, [mapLayer])

  // 4. Render Interactive Patient Density Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !isMapLoaded) return

    import('leaflet').then((module) => {
      const L = module.default
      const map = mapInstanceRef.current
      const markersLayer = markersLayerRef.current
      if (!map || !markersLayer) return

      markersLayer.clearLayers()
      markerMapRef.current.clear()

      const bounds = L.latLngBounds([])
      let hasValidPoints = false

      // 4A. Plot actual patient areas
      const activeAreas = areaData.filter((a) => a.patientCount > 0 && a.coords && a.coords.lat && a.coords.lng)

      activeAreas.forEach((area) => {
        if (!area.coords) return
        hasValidPoints = true
        bounds.extend([area.coords.lat, area.coords.lng])

        // Determine density tier
        const count = area.patientCount
        const isHigh = count >= 15
        const isMid = count >= 5 && count < 15

        const pulseColor = isHigh ? 'bg-purple-500' : isMid ? 'bg-blue-500' : 'bg-cyan-500'
        const badgeBorder = isHigh ? 'border-purple-400 text-purple-300' : isMid ? 'border-blue-400 text-blue-300' : 'border-cyan-400 text-cyan-300'
        const badgeBg = isHigh ? 'bg-purple-950/90' : isMid ? 'bg-blue-950/90' : 'bg-slate-900/90'

        // Modern HTML Marker with badge and count
        const html = `
          <div class="relative flex items-center justify-center cursor-pointer group" style="transform: translate(-50%, -50%);">
            <span class="absolute w-10 h-10 rounded-full ${pulseColor} opacity-30 animate-ping"></span>
            <span class="absolute w-8 h-8 rounded-full ${pulseColor} opacity-40 animate-pulse"></span>
            <div class="relative z-10 px-2.5 py-1 rounded-full ${badgeBg} border-2 ${badgeBorder} shadow-2xl flex items-center gap-1.5 backdrop-blur-md">
              <span class="w-2 h-2 rounded-full ${isHigh ? 'bg-purple-400' : isMid ? 'bg-blue-400' : 'bg-cyan-400'}"></span>
              <span class="text-xs font-black text-white font-mono tracking-tight">${count}</span>
              <span class="text-[9px] font-bold text-slate-300">${language === 'en' ? 'pts' : 'مريض'}</span>
            </div>
            <div class="absolute -bottom-5.5 start-1/2 transform -translate-x-1/2 pointer-events-none whitespace-nowrap px-1.5 py-0.5 rounded-md bg-slate-950/90 text-[10px] font-bold text-slate-200 border border-slate-700 shadow-md">
              ${language === 'en' && area.nameEn ? area.nameEn : area.nameAr}
            </div>
          </div>
        `

        const icon = L.divIcon({
          className: 'custom-real-marker',
          html,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })

        const marker = L.marker([area.coords.lat, area.coords.lng], { icon })

        // Detailed Arabic popup with statistics
        const popupHtml = `
          <div dir="${isRtl ? 'rtl' : 'ltr'}" class="p-2.5 font-sans min-w-[210px] text-right">
            <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
              <div class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-full ${isHigh ? 'bg-purple-600' : isMid ? 'bg-blue-600' : 'bg-cyan-600'}"></span>
                <h4 class="font-black text-sm text-slate-900">${area.nameAr}</h4>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                ${area.governorateAr}
              </span>
            </div>
            ${area.nameEn ? `<p class="text-[11px] text-slate-400 mb-2 font-mono">${area.nameEn}</p>` : ''}
            
            <div class="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mb-2">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500 font-medium">${language === 'en' ? 'Patients Count:' : 'عدد المرضى:'}</span>
                <span class="font-black text-slate-900 text-sm font-mono">${area.patientCount} ${language === 'en' ? 'Patients' : 'مريض'}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500 font-medium">${language === 'en' ? 'Share of Clinic:' : 'النسبة من إجمالي العيادة:'}</span>
                <span class="font-bold text-primary text-xs font-mono">${area.percentage}%</span>
              </div>
            </div>

            <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div class="h-full ${isHigh ? 'bg-purple-600' : isMid ? 'bg-blue-600' : 'bg-cyan-500'} rounded-full" style="width: ${Math.min(100, area.percentage * 2)}%"></div>
            </div>
          </div>
        `

        marker.bindPopup(popupHtml, {
          closeButton: true,
          offset: [0, -10],
          className: 'real-map-popup'
        })

        marker.on('click', () => {
          onSelectArea(area.id)
        })

        marker.addTo(markersLayer)
        markerMapRef.current.set(area.id, marker)
      })

      // 4B. If no patients are mapped yet (e.g., all unrecorded), plot major reference landmarks
      if (!hasValidPoints) {
        MAJOR_EGYPT_LANDMARKS.forEach((lm) => {
          const html = `
            <div class="relative flex items-center justify-center opacity-85 group hover:opacity-100 cursor-pointer" style="transform: translate(-50%, -50%);">
              <div class="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-white shadow-md"></div>
              <div class="absolute -bottom-5 start-1/2 transform -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-slate-900/80 text-[9px] font-bold text-cyan-200 border border-cyan-500/20 shadow-xs pointer-events-none">
                ${language === 'en' ? lm.nameEn : lm.nameAr}
              </div>
            </div>
          `
          const icon = L.divIcon({
            className: 'ref-landmark-marker',
            html,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
          const marker = L.marker([lm.lat, lm.lng], { icon })
          marker.bindPopup(`
            <div dir="${isRtl ? 'rtl' : 'ltr'}" class="p-2 font-sans text-xs text-right">
              <strong class="text-slate-900">${lm.nameAr}</strong>
              <p class="text-[10px] text-slate-500 mt-0.5">${lm.nameEn}</p>
              <p class="text-[10px] text-cyan-700 bg-cyan-50 px-2 py-1 rounded mt-1.5">
                ${language === 'en' ? 'Reference district ready for patient bookings' : 'منطقة مرجعية جاهزة لتسجيل حجوزات المرضى'}
              </p>
            </div>
          `)
          marker.addTo(markersLayer)
        })
      } else if (hasValidPoints && activeAreas.length > 0) {
        // Automatically frame all active patient locations
        if (activeAreas.length === 1 && activeAreas[0].coords) {
          map.setView([activeAreas[0].coords.lat, activeAreas[0].coords.lng], 13)
        } else {
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
        }
      }
    })
  }, [areaData, isMapLoaded, isRtl, language, onSelectArea])

  // 5. Handle flyTo when an area is selected from the side panel
  useEffect(() => {
    if (!selectedAreaId || !mapInstanceRef.current || !isMapLoaded) return

    const marker = markerMapRef.current.get(selectedAreaId)
    if (marker) {
      const latLng = marker.getLatLng()
      mapInstanceRef.current.flyTo(latLng, 14, { duration: 1.2 })
      marker.openPopup()
      return
    }

    // Fallback: search in areaData
    const area = areaData.find((a) => a.id === selectedAreaId)
    if (area && area.coords) {
      mapInstanceRef.current.flyTo([area.coords.lat, area.coords.lng], 14, { duration: 1.2 })
    }
  }, [selectedAreaId, areaData, isMapLoaded])

  // Custom Zoom Handlers
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn()
  }

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut()
  }

  const handleReset = () => {
    if (mapInstanceRef.current) {
      const activeAreas = areaData.filter((a) => a.patientCount > 0 && a.coords)
      if (activeAreas.length > 0) {
        import('leaflet').then((m) => {
          const L = m.default
          const bounds = L.latLngBounds(activeAreas.map((a) => [a.coords!.lat, a.coords!.lng]))
          mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
        })
      } else {
        mapInstanceRef.current.setView([30.0444, 31.2357], 7)
      }
    }
  }

  return (
    <div
      className={`relative w-full rounded-3xl overflow-hidden border border-slate-700/60 shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'fixed inset-4 z-50 rounded-2xl h-[calc(100vh-2rem)]' : 'h-[520px]'
      }`}
    >
      {/* Real Leaflet Map Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full bg-[#0d1624] z-0"
        style={{ cursor: 'grab' }}
      />

      {/* Top Floating Bar: Layer Switcher & Fullscreen */}
      <div className="absolute top-3.5 start-3.5 z-20 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-950/85 backdrop-blur-md p-1 rounded-2xl border border-cyan-500/30 shadow-xl">
          <button
            type="button"
            onClick={() => setMapLayer('google_streets')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              mapLayer === 'google_streets'
                ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'Google Maps' : 'خريطة جوجل الفصيلية'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMapLayer('google_satellite')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              mapLayer === 'google_satellite'
                ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'Satellite' : 'قمر صناعي'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMapLayer('carto_voyager')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              mapLayer === 'carto_voyager'
                ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'Carto / Streets' : 'أحياء وشوارع'}</span>
          </button>
        </div>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="w-8 h-8 rounded-xl bg-slate-950/85 backdrop-blur-md border border-cyan-500/30 text-slate-200 hover:text-white hover:bg-cyan-500/20 flex items-center justify-center transition-colors shadow-xl cursor-pointer"
          title={isFullscreen ? 'تصغير الخريطة' : 'ملء الشاشة'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Top End Floating Bar: Zoom & Reset Controls */}
      <div className="absolute top-3.5 end-3.5 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 bg-slate-950/85 backdrop-blur-md p-1 rounded-2xl border border-cyan-500/30 shadow-xl">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-7 h-7 rounded-xl bg-white/10 hover:bg-cyan-500/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="تكبير (أو استخدم عجلة الماوس)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-7 h-7 rounded-xl bg-white/10 hover:bg-cyan-500/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="تصغير"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="w-7 h-7 rounded-xl bg-white/10 hover:bg-cyan-500/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="إعادة ضبط زاوية الرؤية"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-cyan-400 font-bold px-1.5">
            Lv {currentZoom}
          </span>
        </div>

        {/* Live Indicator Badge */}
        <div className="bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-xl border border-cyan-500/30 text-[10px] text-cyan-300 font-bold flex items-center gap-1.5 shadow-xl">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>{language === 'en' ? 'Live Interactive Tiles' : 'خرائط جوجل الحية • زوم الأحياء مفعّل'}</span>
        </div>
      </div>

      {/* Bottom Floating Bar: Legend & Navigation Tip */}
      <div className="absolute bottom-3.5 start-3.5 end-3.5 z-20 flex flex-col sm:flex-row items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto bg-slate-950/90 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-cyan-500/30 text-[11px] text-slate-300 flex items-center gap-3 shadow-xl">
          <span className="text-cyan-400 font-bold flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{language === 'en' ? 'Patient Density:' : 'كثافة المرضى:'}</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px]">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
              <span>1 - 4</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[10px]">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>5 - 14</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[10px]">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <span>15+</span>
            </span>
          </div>
        </div>

        <div className="pointer-events-auto bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700/60 text-[10px] text-slate-400 flex items-center gap-1.5 shadow-xl">
          <Navigation className="w-3 h-3 text-cyan-400" />
          <span>{language === 'en' ? 'Scroll wheel zooms map directly without moving page' : 'عجلة الماوس تعمل زوم مباشر بالخريطة بدون تحريك الصفحة'}</span>
        </div>
      </div>
    </div>
  )
}
