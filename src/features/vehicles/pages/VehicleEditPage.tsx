import { useParams } from "@tanstack/react-router";
import { VehicleFormPage } from "./VehicleFormPage";

export default function VehicleEditPage() {
  const { vehicleId } = useParams({ from: "/veiculos/$vehicleId_/editar" });
  return <VehicleFormPage mode="edit" vehicleId={vehicleId} />;
}
