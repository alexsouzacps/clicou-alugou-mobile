export type RootStackParamList = {
  '(auth)': undefined;
  '(tabs)': undefined;
  'imovel/[id]': { id: string };
  'proposta/[propertyId]': { propertyId: string };
  'contrato/[id]': { id: string };
  'reserva/[id]': { id: string };
  'manutencao/index': undefined;
  'manutencao/nova': { contractId?: string };
  'manutencao/[id]': { id: string };
  'chat/[roomId]': { roomId: string; title?: string };
  'proposta/recebidas': undefined;
};
