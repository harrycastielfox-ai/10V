import type { NexoMapPoint } from "./nexoTypes";

export function isGeographicArea(points: NexoMapPoint[]) {
  return (
    points.length > 0 &&
    points.every(
      (point) =>
        point.coordinateSystem === "wgs84" &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        Math.abs(point.x) <= 180 &&
        Math.abs(point.y) <= 90,
    )
  );
}

export function geographicPoint(latitude: number, longitude: number): NexoMapPoint {
  return { x: longitude, y: latitude, coordinateSystem: "wgs84" };
}

export function circleArea(latitude: number, longitude: number, radiusMeters: number) {
  const angular = radiusMeters / 6371008.8;
  const lat = (latitude * Math.PI) / 180;
  const lng = (longitude * Math.PI) / 180;
  return Array.from({ length: 48 }, (_, index) => {
    const bearing = (index * 2 * Math.PI) / 48;
    const nextLat = Math.asin(
      Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing),
    );
    const nextLng =
      lng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
        Math.cos(angular) - Math.sin(lat) * Math.sin(nextLat),
      );
    return geographicPoint((nextLat * 180) / Math.PI, (nextLng * 180) / Math.PI);
  });
}
