'use client';

import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';

type RiskStatus = 'Sem histórico' | 'Normal' | 'Alto' | 'Crítico' | string;

export type PixelSummary = {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  status: RiskStatus;
  variable_name?: string | null;
  anomaly_date?: string | null;
  boundary_geojson?: {
    type: 'Polygon';
    coordinates: number[][][];
  } | null;
};

type EcoGridLeafletMapProps = {
  pixels: PixelSummary[];
  selectedPixelId: string | null;
  onSelectPixel: (pixelId: string) => void;
};

const DEFAULT_CENTER: [number, number] = [-16.6869, -49.2648];

function getVariableLabel(variableName?: string | null) {
  if (!variableName) return 'Sem anomalia';

  const labels: Record<string, string> = {
    temperature_forecast: 'Temperatura',
    precipitation_forecast: 'Precipitação',
    humidity_forecast: 'Umidade',
    multivariate_weather_forecast: 'Anomalia composta'
  };

  return labels[variableName] || variableName;
}

function getStatusLabel(status: RiskStatus) {
  if (status === 'Normal') return 'Estável';
  return status;
}

function formatarData(date?: string | null) {
  if (!date) return 'Sem registro';

  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR');
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getPolygonStyle(status: RiskStatus, isSelected: boolean) {
  if (status === 'Sem histórico') {
    return {
      color: '#94a3b8',
      fillColor: '#475569',
      fillOpacity: isSelected ? 0.45 : 0.18,
      weight: isSelected ? 3 : 1
    };
  }

  if (status === 'Crítico') {
    return {
      color: '#fb7185',
      fillColor: '#f43f5e',
      fillOpacity: isSelected ? 0.55 : 0.35,
      weight: isSelected ? 3 : 1.5
    };
  }

  if (status === 'Alto') {
    return {
      color: '#fcd34d',
      fillColor: '#f59e0b',
      fillOpacity: isSelected ? 0.55 : 0.35,
      weight: isSelected ? 3 : 1.5
    };
  }

  return {
    color: '#6ee7b7',
    fillColor: '#10b981',
    fillOpacity: isSelected ? 0.45 : 0.22,
    weight: isSelected ? 3 : 1
  };
}

function montarPopupHtml(pixel: PixelSummary) {
  return `
    <div style="min-width: 180px; color: #0f172a;">
      <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 0;">
        ${escapeHtml(pixel.code)} · Quadrante H3
      </p>

      <h4 style="font-size: 14px; font-weight: 700; color: #020617; margin: 4px 0;">
        ${escapeHtml(pixel.name)}
      </h4>

      <p style="font-size: 12px; color: #334155; margin: 4px 0;">
        Status: <strong>${escapeHtml(getStatusLabel(pixel.status))}</strong>
      </p>

      <p style="font-size: 12px; color: #334155; margin: 4px 0;">
        Variável: <strong>${escapeHtml(getVariableLabel(pixel.variable_name))}</strong>
      </p>

      <p style="font-size: 12px; color: #334155; margin: 4px 0;">
        Último registro: <strong>${escapeHtml(formatarData(pixel.anomaly_date))}</strong>
      </p>

      <p style="font-size: 10px; color: #64748b; margin: 8px 0 0; font-family: monospace;">
        Lat: ${Number(pixel.latitude).toFixed(4)} | Lon: ${Number(pixel.longitude).toFixed(4)}
      </p>
    </div>
  `;
}

function converterGeoJsonParaLatLng(
  boundaryGeojson: PixelSummary['boundary_geojson']
): [number, number][] | null {
  if (!boundaryGeojson?.coordinates?.[0]) return null;

  return boundaryGeojson.coordinates[0].map(([lng, lat]) => [lat, lng]);
}

export default function EcoGridLeafletMap({
  pixels,
  selectedPixelId,
  onSelectPixel
}: EcoGridLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 10,
      scrollWheelZoom: true,
      zoomControl: true
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);

    mapRef.current = map;
    layerRef.current = layer;

    const resizeTimeout = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      window.clearTimeout(resizeTimeout);

      layer.clearLayers();
      map.off();
      map.remove();

      layerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;

    if (!map || !layer) return;

    layer.clearLayers();
    map.closePopup();

    const bounds = L.latLngBounds([]);

    const pixelsValidos = pixels.filter(
      (pixel) =>
        Number.isFinite(pixel.latitude) &&
        Number.isFinite(pixel.longitude) &&
        pixel.boundary_geojson
    );

    if (pixelsValidos.length === 0) {
      map.setView(DEFAULT_CENTER, 10);
      return;
    }

    pixelsValidos.forEach((pixel) => {
      const polygonLatLng = converterGeoJsonParaLatLng(pixel.boundary_geojson);

      if (!polygonLatLng) return;

      const isSelected = selectedPixelId === pixel.id;
      const style = getPolygonStyle(pixel.status, isSelected);

      const polygon = L.polygon(polygonLatLng, style);

      polygon.bindPopup(montarPopupHtml(pixel));

      polygon.on('click', () => {
        onSelectPixel(pixel.id);
        polygon.openPopup();
      });

      polygon.addTo(layer);

      const label = L.marker([pixel.latitude, pixel.longitude], {
        interactive: false,
        icon: L.divIcon({
          className: '',
          html: `
            <div style="
              background: rgba(15, 23, 42, 0.88);
              border: 1px solid rgba(148, 163, 184, 0.55);
              color: #f8fafc;
              border-radius: 6px;
              padding: 2px 5px;
              font-size: 10px;
              font-weight: 800;
              box-shadow: 0 4px 10px rgba(0,0,0,0.35);
              white-space: nowrap;
            ">
              ${escapeHtml(pixel.code)}
            </div>
          `,
          iconSize: [42, 18],
          iconAnchor: [21, 9]
        })
      });

      label.addTo(layer);

      polygonLatLng.forEach((point) => bounds.extend(point));
    });

    if (selectedPixelId) {
      const selectedPixel = pixelsValidos.find(
        (pixel) => pixel.id === selectedPixelId
      );

      if (selectedPixel) {
        map.setView([selectedPixel.latitude, selectedPixel.longitude], 12, {
          animate: true
        });
      }
    } else if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 12
      });
    }

    const resizeTimeout = window.setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      window.clearTimeout(resizeTimeout);
    };
  }, [pixels, selectedPixelId, onSelectPixel]);

  return <div ref={containerRef} className="h-full w-full z-0" />;
}