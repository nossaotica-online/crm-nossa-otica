export type ClientStatus = 'active' | 'archived';

export type ClientSource = 'meta' | 'google' | 'instagram' | 'indicacao' | 'loja' | 'cliente_antigo' | 'whatsapp' | 'outro';
export type OpticalProduct = 'oculos_completo' | 'lentes' | 'armacao' | 'oculos_sol' | 'manutencao';

export type RelationshipType =
  | 'pai' | 'mãe' | 'filho' | 'filha' | 'marido' | 'esposa'
  | 'companheiro' | 'companheira' | 'irmão' | 'irmã' | 'avô' | 'avó'
  | 'neto' | 'neta' | 'tio' | 'tia' | 'primo' | 'prima'
  | 'sogro' | 'sogra' | 'genro' | 'nora' | 'outro';

export interface FamilyGroup {
  id: string;
  name: string;
  created_at: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  whatsapp: string | null;
  secondary_phone: string | null;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  email: string | null;
  notes: string | null;
  family_group_id: string | null;
  referred_by_client_id: string | null;
  source: ClientSource;
  source_details: string | null;
  product_interests: OpticalProduct[];
  status: ClientStatus;
  created_at: string;
  updated_at: string;
}

export interface FamilyRelationship {
  id: string;
  client_id: string;
  related_client_id: string;
  relationship_type: RelationshipType;
  created_at: string;
}

export interface ClientFormValues {
  name: string;
  whatsapp: string;
  secondary_phone: string;
  cpf: string;
  rg: string;
  birth_date: string;
  email: string;
  notes: string;
  family_group_id: string;
  referred_by_client_id: string;
  related_client_id: string;
  relationship_type: RelationshipType;
  source: ClientSource | '';
  source_details: string;
  product_interests: OpticalProduct[];
}

export interface ClientPrescription {
  id: string;
  client_id: string;
  prescription_date: string;
  doctor_name: string | null;
  doctor_crm: string | null;
  od_sphere: number | null;
  od_cylinder: number | null;
  od_axis: number | null;
  od_addition: number | null;
  oe_sphere: number | null;
  oe_cylinder: number | null;
  oe_axis: number | null;
  oe_addition: number | null;
  dnp_right: number | null;
  dnp_left: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ServiceOrderStatus = 'aberta' | 'em_producao' | 'pronta' | 'entregue' | 'cancelada';

export interface ServiceOrder {
  id: string;
  os_number: number;
  client_id: string | null;
  client_name: string;
  cpf: string | null;
  rg: string | null;
  phone: string | null;
  product_type: string | null;
  frame_description: string | null;
  lens_description: string | null;
  od_sphere: number | null;
  od_cylinder: number | null;
  od_axis: number | null;
  od_addition: number | null;
  oe_sphere: number | null;
  oe_cylinder: number | null;
  oe_axis: number | null;
  oe_addition: number | null;
  dnp: string | null;
  total: number;
  down_payment: number;
  payment_method: string | null;
  status: ServiceOrderStatus;
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionFormValues {
  prescription_date: string;
  doctor_name: string;
  doctor_crm: string;
  od_sphere: string;
  od_cylinder: string;
  od_axis: string;
  od_addition: string;
  oe_sphere: string;
  oe_cylinder: string;
  oe_axis: string;
  oe_addition: string;
  dnp_right: string;
  dnp_left: string;
  notes: string;
}
