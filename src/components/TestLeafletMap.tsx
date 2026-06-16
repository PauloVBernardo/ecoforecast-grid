'use client';

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';

export default function TestLeafletMap() {
  return (
    <div className="h-[420px] w-full rounded-xl overflow-hidden">
      <MapContainer
        center={[-16.6869, -49.2648]}
        zoom={11}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <CircleMarker
          center={[-16.6869, -49.2648]}
          radius={12}
          pathOptions={{
            color: '#38bdf8',
            fillColor: '#38bdf8',
            fillOpacity: 0.8
          }}
        >
          <Popup>Goiânia</Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}