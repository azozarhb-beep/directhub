'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type GeometryMode = 'radius' | 'polygon';
export type LatLngTuple = [number, number];

export interface ZoneGeometry {
  mode: GeometryMode;
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number | null;
  polygon: LatLngTuple[];
}

interface ZoneMapPickerProps {
  value: ZoneGeometry;
  onChange: (next: ZoneGeometry) => void;
  overlays?: { id: string; label: string; geometry: ZoneGeometry }[];
}

const DEFAULT_CENTER: LatLngTuple = [25, 40];

export default function ZoneMapPicker({ value, onChange, overlays = [] }: ZoneMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);
  const valueRef = useRef<ZoneGeometry>(value);
  const onChangeRef = useRef(onChange);
  const fittedRef = useRef(false);

  valueRef.current = value;
  onChangeRef.current = onChange;

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    overlayLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on('click', (e: L.LeafletMouseEvent) => {
      const v = valueRef.current;
      if (v.mode === 'radius') {
        onChangeRef.current({
          ...v,
          centerLat: Number(e.latlng.lat.toFixed(6)),
          centerLng: Number(e.latlng.lng.toFixed(6)),
          radiusKm: v.radiusKm && v.radiusKm > 0 ? v.radiusKm : 5,
        });
      } else {
        onChangeRef.current({
          ...v,
          polygon: [...v.polygon, [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))]],
        });
      }
    });

    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      overlayLayerRef.current = null;
    };
  }, []);

  // Draw current geometry
  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;
    group.clearLayers();

    const pointIcon = L.divIcon({
      className: '',
      html: '<div style="width:12px;height:12px;border-radius:9999px;background:#10b981;border:2px solid #fff;box-shadow:0 0 0 1px #065f46"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    let bounds: L.LatLngBounds | null = null;

    if (value.mode === 'radius' && value.centerLat != null && value.centerLng != null) {
      const center: LatLngTuple = [value.centerLat, value.centerLng];
      const marker = L.marker(center, { icon: pointIcon, draggable: true }).addTo(group);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        onChangeRef.current({
          ...valueRef.current,
          centerLat: Number(p.lat.toFixed(6)),
          centerLng: Number(p.lng.toFixed(6)),
        });
      });
      if (value.radiusKm && value.radiusKm > 0) {
        const circle = L.circle(center, {
          radius: value.radiusKm * 1000,
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.15,
          weight: 2,
        }).addTo(group);
        bounds = circle.getBounds();
      } else {
        bounds = L.latLngBounds([center, center]);
      }
    }

    if (value.mode === 'polygon' && value.polygon.length > 0) {
      value.polygon.forEach((pt, idx) => {
        const m = L.marker(pt, { icon: pointIcon, draggable: true }).addTo(group);
        m.on('dragend', () => {
          const p = m.getLatLng();
          const next = [...valueRef.current.polygon];
          next[idx] = [Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))];
          onChangeRef.current({ ...valueRef.current, polygon: next });
        });
      });
      if (value.polygon.length >= 3) {
        const poly = L.polygon(value.polygon, {
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.15,
          weight: 2,
        }).addTo(group);
        bounds = poly.getBounds();
      } else {
        L.polyline(value.polygon, { color: '#10b981', weight: 2, dashArray: '4 4' }).addTo(group);
        bounds = L.latLngBounds(value.polygon);
      }
    }

    if (bounds && bounds.isValid() && !fittedRef.current) {
      map.fitBounds(bounds, { maxZoom: 14, padding: [30, 30] });
      fittedRef.current = true;
    }
    if (!bounds) fittedRef.current = false;
  }, [value]);

  // Draw other zones as muted overlays
  useEffect(() => {
    const group = overlayLayerRef.current;
    if (!group) return;
    group.clearLayers();
    overlays.forEach((o) => {
      const g = o.geometry;
      const style = { color: '#64748b', fillColor: '#64748b', fillOpacity: 0.08, weight: 1 };
      if (g.mode === 'radius' && g.centerLat != null && g.centerLng != null && g.radiusKm) {
        L.circle([g.centerLat, g.centerLng], { ...style, radius: g.radiusKm * 1000 })
          .bindTooltip(o.label)
          .addTo(group);
      } else if (g.mode === 'polygon' && g.polygon.length >= 3) {
        L.polygon(g.polygon, style).bindTooltip(o.label).addTo(group);
      }
    });
  }, [overlays]);

  return <div ref={containerRef} className="w-full h-[360px] rounded-xl overflow-hidden border border-slate-700 z-0" />;
}
