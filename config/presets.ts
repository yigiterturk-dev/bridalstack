import { PackId } from "./modules";

export type IndustryPreset = {
  id: string;
  name: string;
  description: string;
  icon: string;
  packs: PackId[];
  starterServices?: { name: string; duration: number }[];
};

export const PRESETS: IndustryPreset[] = [
  {
    id: "hair_salon",
    name: "Hair Salon",
    description: "Appointments, services, staff scheduling, online booking",
    icon: "content_cut",
    packs: ["base", "salon", "sales", "finance"],
  },
  {
    id: "barber",
    name: "Barber Shop",
    description: "Walk-ins, bookings, POS, commissions",
    icon: "face",
    packs: ["base", "salon", "sales", "pro"],
  },
  {
    id: "nail_salon",
    name: "Nail Salon",
    description: "Nail services, booking, loyalty programs",
    icon: "spa",
    packs: ["base", "salon", "sales"],
  },
  {
    id: "spa",
    name: "Spa & Wellness",
    description: "Treatments, packages, multi-room scheduling",
    icon: "self_improvement",
    packs: ["base", "salon", "sales", "finance", "inventory"],
  },
  {
    id: "tattoo",
    name: "Tattoo Studio",
    description: "Consultations, deposits, portfolio, aftercare",
    icon: "brush",
    packs: ["base", "salon", "sales"],
  },
  {
    id: "clinic",
    name: "Aesthetics Clinic",
    description: "Medical spa, treatments, patient records",
    icon: "medical_services",
    packs: ["base", "salon", "sales", "finance", "inventory"],
  },
  {
    id: "bridal",
    name: "Bridal Shop",
    description: "Gown sales/rental, try-ons, alterations",
    icon: "checkroom",
    packs: ["base", "sales", "finance", "inventory", "pro"],
    starterServices: [
      { name: "Bridal Consultation", duration: 60 },
      { name: "First Fitting", duration: 90 },
      { name: "Final Fitting", duration: 60 },
      { name: "Alterations Consultation", duration: 30 },
    ],
  },
  {
    id: "custom",
    name: "Custom Setup",
    description: "Pick exactly the modules you need",
    icon: "tune",
    packs: ["base"],
  },
];
