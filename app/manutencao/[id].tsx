import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { safeImpactAsync, safeNotificationAsync } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { showAlert } from '@/utils/crossAlert';
import { supabase } from '@/services/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { formatPrice } from '@/utils/format';
import {
  MaintenanceEventRow,
  MaintenanceMediaRow,
  MaintenanceQuoteRow,
  MaintenanceStatus,
} from '@/types/database';

// ── Config de status / rótulos (espelha o site) ──
const STATUS_STEPS = [
  { key: 'aberta', label: 'Aberta', icon: 'folder-open-outline' as const },
  { key: 'em_analise', label: 'Em análise', icon: 'magnify' as const },
  { key: 'aguardando_aprovacao', label: 'Aprovação', icon: 'gavel' as const },
  { key: 'aprovado', label: 'Aprovado', icon: 'thumb-up-outline' as const },
  { key: 'em_execucao', label: 'Em execução', icon: 'hammer-wrench' as const },
  { key: 'servico_concluido', label: 'Concluído', icon: 'check-circle-outline' as const },
  { key: 'aguardando_validacao', label: 'Validação', icon: 'clipboard-check-outline' as const },
  { key: 'finalizado', label: 'Finalizado', icon: 'shield-check-outline' as const },
];

const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  aguardando_aprovacao: 'Aguard. aprovação',
  orcamento_enviado: 'Orçamento enviado',
  aprovado: 'Aprovado',
  em_execucao: 'Em execução',
  servico_concluido: 'Serviço concluído',
  aguardando_validacao: 'Aguard. validação',
  finalizado: 'Finalizado',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const CATEGORY_LABEL: Record<string, string> = {
  hidraulica: 'Hidráulica',
  eletrica: 'Elétrica',
  estrutural: 'Estrutural',
  pintura: 'Pintura',
  esquadrias: 'Esquadrias / Janelas',
  ar_condicionado: 'Ar-condicionado',
  outro: 'Outro',
};

const RESPONSIBLE_LABEL: Record<string, string> = {
  owner: 'Proprietário',
  tenant: 'Locatário',
  condo: 'Condomínio',
  technical_inspection: 'Vistoria técnica necessária',
};

function isDelayed(req: {
  status: string;
  created_at: string;
  is_urgent: boolean;
  priority: string;
  approval_deadline_at: string | null;
  scheduled_date: string | null;
}): boolean {
  if (req.status === 'finalizado' || req.status === 'concluida' || req.status === 'cancelada') return false;
  const hoursOpen = (Date.now() - new Date(req.created_at).getTime()) / 3_600_000;
  const urgent = req.is_urgent || req.priority === 'urgente';

  if (urgent && (req.status === 'aberta' || req.status === 'aguardando_aprovacao') && hoursOpen > 4) return true;
  if (req.approval_deadline_at && new Date(req.approval_deadline_at).getTime() < Date.now()) return true;
  if ((req.status === 'aberta' || req.status === 'aguardando_aprovacao') && hoursOpen > 48) return true;
  if (
    req.scheduled_date &&
    new Date(`${req.scheduled_date}T23:59:59`).getTime() < Date.now() &&
    (req.status === 'em_execucao' || req.status === 'aprovado' || req.status === 'em_analise')
  ) {
    return true;
  }
  return false;
}

function getDelayText(req: Parameters<typeof isDelayed>[0]): string {
  if (req.approval_deadline_at && new Date(req.approval_deadline_at).getTime() < Date.now()) {
    return 'Prazo de aprovação (48h) vencido';
  }
  if (req.scheduled_date && new Date(`${req.scheduled_date}T23:59:59`).getTime() < Date.now()) {
    return `Data de execução em atraso (previsão: ${new Date(req.scheduled_date).toLocaleDateString('pt-BR')})`;
  }
  return 'Solicitação com SLA atrasado';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface TicketDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: MaintenanceStatus;
  reporter_id: string;
  reporter_role: string;
  is_urgent: boolean;
  responsible_party: string | null;
  legal_basis: string | null;
  approval_deadline_at: string | null;
  service_rating: number | null;
  service_rating_note: string | null;
  problem_start_date: string | null;
  scheduled_date: string | null;
  created_at: string;
  property: {
    id: string;
    title: string;
    address_city: string;
    owner_id: string;
    owner: { full_name: string; email: string | null } | null;
  } | null;
  reporter: { full_name: string; email: string | null } | null;
}

interface MediaWithUrl extends MaintenanceMediaRow {
  signedUrl?: string;
}

export default function ManutencaoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [media, setMedia] = useState<MediaWithUrl[]>([]);
  const [events, setEvents] = useState<MaintenanceEventRow[]>([]);
  const [quotes, setQuotes] = useState<MaintenanceQuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  async function loadAll() {
    setLoading(true);
    try {
      const { data: ticketData } = await supabase
        .from('maintenance_requests')
        .select(
          '*, property:properties(id, title, address_city, owner_id, owner:profiles!properties_owner_id_fkey(full_name, email)), reporter:profiles!maintenance_requests_reporter_id_fkey(full_name, email)'
        )
        .eq('id', id)
        .single();

      setTicket(ticketData as unknown as TicketDetail);

      const [{ data: mediaData }, { data: eventsData }, { data: quotesData }] = await Promise.all([
        supabase.from('maintenance_media').select('*').eq('request_id', id).order('created_at', { ascending: true }),
        supabase
          .from('maintenance_events')
          .select('*')
          .eq('request_id', id)
          .order('created_at', { ascending: false }),
        supabase.from('maintenance_quotes').select('*').eq('request_id', id).order('submitted_at', { ascending: false }),
      ]);

      const rawMedia = (mediaData || []) as MaintenanceMediaRow[];
      const withUrls = await Promise.all(
        rawMedia.map(async (m) => {
          const { data } = await supabase.storage
            .from('maintenance-media')
            .createSignedUrl(m.storage_path, 3600);
          return { ...m, signedUrl: data?.signedUrl };
        })
      );

      setMedia(withUrls);
      setEvents((eventsData || []) as MaintenanceEventRow[]);
      setQuotes((quotesData || []) as MaintenanceQuoteRow[]);
    } catch (err) {
      console.warn('[ManutencaoDetail] Erro:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRespondQuote(quoteId: string, action: 'approve' | 'reject') {
    safeImpactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionLoadingId(quoteId);
    const { error } = await supabase.rpc('respond_maintenance_quote', {
      p_quote_id: quoteId,
      p_action: action,
    });
    setActionLoadingId(null);

    if (error) {
      showAlert('Erro', error.message);
      return;
    }
    safeNotificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert(
      action === 'approve' ? 'Orçamento aprovado!' : 'Orçamento recusado',
      action === 'approve'
        ? 'O serviço foi movido para Em Execução.'
        : 'A solicitação retornou para análise.'
    );
    loadAll();
  }

  if (loading) {
    return <LoadingSpinner fullScreen message="Carregando chamado..." />;
  }

  if (!ticket) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Chamado não encontrado" showBack />
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Este chamado não existe ou foi removido.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const delayed = isDelayed(ticket);
  const isUrgent = ticket.is_urgent || ticket.priority === 'urgente';
  const normalizedStatus = ticket.status === 'concluida' ? 'finalizado' : ticket.status;
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === normalizedStatus);
  const isOwnerOfProperty = ticket.property?.owner_id === user?.id;

  const beforeMedia = media.filter((m) => m.stage === 'before');
  const afterMedia = media.filter((m) => m.stage === 'after');

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={`Chamado #${ticket.id.slice(0, 8).toUpperCase()}`} showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Cabeçalho: badges + título + imóvel/proprietário */}
        <Card style={styles.card}>
          <View style={styles.badgeRow}>
            <Badge label={STATUS_LABEL[ticket.status] || ticket.status} variant="info" size="sm" />
            {isUrgent && <Badge label="URGENTE" variant="error" size="sm" />}
            <Badge label={CATEGORY_LABEL[ticket.category] || ticket.category} variant="neutral" size="sm" />
          </View>
          <Text style={styles.titleText}>{ticket.title}</Text>
          <Text style={styles.subLine}>
            Imóvel: <Text style={styles.subLineBold}>{ticket.property?.title || '—'}</Text>
            {ticket.property?.address_city ? ` (${ticket.property.address_city})` : ''}
          </Text>
          {ticket.property?.owner?.full_name && (
            <Text style={styles.subLine}>
              Proprietário: <Text style={styles.subLineBold}>{ticket.property.owner.full_name}</Text>
              {ticket.property.owner.email ? ` (${ticket.property.owner.email})` : ''}
            </Text>
          )}
        </Card>

        {/* Banner de atraso */}
        {delayed && (
          <Card style={styles.delayCard}>
            <View style={styles.delayHeader}>
              <MaterialCommunityIcons name="alert" size={22} color={colors.error} />
              <View style={{ flex: 1 }}>
                <Text style={styles.delayTitle}>Solicitação Atrasada!</Text>
                <Text style={styles.delaySub}>{getDelayText(ticket)}</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Stepper de progresso */}
        <Text style={styles.sectionHeader}>Progresso do Chamado</Text>
        <Card style={styles.stepperCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.stepperRow}>
              {STATUS_STEPS.map((step, idx) => {
                const isDone = idx < currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                const color = isDone ? colors.success : isCurrent ? colors.orange : colors.gray;
                return (
                  <View key={step.key} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepCircle,
                        { borderColor: color },
                        isDone && { backgroundColor: '#ecfdf5' },
                        isCurrent && { backgroundColor: 'rgba(255,75,38,0.1)' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={isDone ? 'check' : step.icon}
                        size={16}
                        color={color}
                      />
                    </View>
                    <Text style={[styles.stepLabel, { color }, isCurrent && { fontWeight: typography.weights.bold }]}>
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </Card>

        {/* Responsável / Fundamento legal */}
        {ticket.responsible_party && (
          <Card
            style={{
              ...styles.card,
              ...(ticket.responsible_party === 'tenant' ? styles.responsibleTenant : styles.responsibleOwner),
            }}
          >
            <View style={styles.responsibleHeader}>
              <MaterialCommunityIcons
                name="gavel"
                size={18}
                color={ticket.responsible_party === 'tenant' ? '#d97706' : colors.blue}
              />
              <Text
                style={[
                  styles.responsibleTitle,
                  { color: ticket.responsible_party === 'tenant' ? '#92400e' : '#1d4ed8' },
                ]}
              >
                Responsável: {RESPONSIBLE_LABEL[ticket.responsible_party] || ticket.responsible_party}
              </Text>
            </View>
            {ticket.legal_basis && (
              <View style={styles.legalBasisBox}>
                <Text style={styles.legalBasisText}>
                  <Text style={{ fontWeight: typography.weights.bold }}>Fundamento Legal: </Text>
                  {ticket.legal_basis}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Solicitante / Proprietário */}
        <View style={styles.infoGrid}>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxLabel}>Solicitante</Text>
            <Text style={styles.infoBoxValue}>{ticket.reporter?.full_name || '—'}</Text>
            {ticket.reporter?.email && <Text style={styles.infoBoxSub}>{ticket.reporter.email}</Text>}
            <Text style={styles.infoBoxSub}>
              Função: {ticket.reporter_role === 'tenant' ? 'Locatário' : ticket.reporter_role === 'owner' ? 'Proprietário' : ticket.reporter_role}
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxLabel}>Proprietário do Imóvel</Text>
            <Text style={styles.infoBoxValue}>{ticket.property?.owner?.full_name || '—'}</Text>
            {ticket.property?.owner?.email && (
              <Text style={styles.infoBoxSub}>{ticket.property.owner.email}</Text>
            )}
          </View>
        </View>

        {/* Descrição e datas */}
        <Text style={styles.sectionHeader}>Descrição do Problema</Text>
        <Card style={styles.card}>
          <Text style={styles.descText}>{ticket.description}</Text>
        </Card>

        <View style={styles.infoGrid}>
          <View style={styles.dateBox}>
            <Text style={styles.infoBoxLabel}>Data de abertura</Text>
            <Text style={styles.infoBoxValue}>{fmtDate(ticket.created_at)}</Text>
          </View>
          {ticket.scheduled_date && (
            <View style={[styles.dateBox, styles.dateBoxHighlight]}>
              <Text style={[styles.infoBoxLabel, { color: colors.blue }]}>Previsão de execução</Text>
              <Text style={[styles.infoBoxValue, { color: colors.blue }]}>{fmtDate(ticket.scheduled_date)}</Text>
            </View>
          )}
        </View>

        {/* Mídias */}
        {(beforeMedia.length > 0 || afterMedia.length > 0) && (
          <>
            <Text style={styles.sectionHeader}>Mídias & Anexos</Text>
            {beforeMedia.length > 0 && (
              <>
                <Text style={styles.mediaGroupLabel}>Fotos do problema (Antes)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                  {beforeMedia.map((m) => (
                    <Image
                      key={m.id}
                      source={{ uri: m.signedUrl }}
                      style={styles.mediaThumb}
                      contentFit="cover"
                    />
                  ))}
                </ScrollView>
              </>
            )}
            {afterMedia.length > 0 && (
              <>
                <Text style={[styles.mediaGroupLabel, { color: colors.success }]}>Fotos após reparo (Depois)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                  {afterMedia.map((m) => (
                    <Image
                      key={m.id}
                      source={{ uri: m.signedUrl }}
                      style={styles.mediaThumb}
                      contentFit="cover"
                    />
                  ))}
                </ScrollView>
              </>
            )}
          </>
        )}

        {/* Orçamentos */}
        {quotes.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Orçamentos Registrados</Text>
            {quotes.map((q) => (
              <Card key={q.id} style={q.status === 'pendente' ? styles.quotePendingCard : styles.card}>
                <View style={styles.quoteHeader}>
                  <View>
                    <Text style={styles.quoteAmount}>{formatPrice(q.amount)}</Text>
                    <Text style={styles.infoBoxSub}>{q.description}</Text>
                  </View>
                  <Badge
                    label={q.status.toUpperCase()}
                    variant={q.status === 'aprovado' ? 'success' : q.status === 'pendente' ? 'warning' : 'neutral'}
                    size="sm"
                  />
                </View>
                {q.status === 'pendente' && isOwnerOfProperty && (
                  <View style={styles.quoteActions}>
                    <Button
                      label="Recusar"
                      onPress={() => handleRespondQuote(q.id, 'reject')}
                      variant="danger"
                      size="sm"
                      loading={actionLoadingId === q.id}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Aprovar Orçamento"
                      onPress={() => handleRespondQuote(q.id, 'approve')}
                      size="sm"
                      loading={actionLoadingId === q.id}
                      style={{ flex: 1.5, backgroundColor: colors.success }}
                    />
                  </View>
                )}
              </Card>
            ))}
          </>
        )}

        {/* Avaliação */}
        {ticket.service_rating != null && (
          <>
            <Text style={styles.sectionHeader}>Avaliação do Locatário</Text>
            <Card style={styles.ratingCard}>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <MaterialCommunityIcons
                    key={s}
                    name={s <= (ticket.service_rating || 0) ? 'star' : 'star-outline'}
                    size={20}
                    color={colors.warning}
                  />
                ))}
                <Text style={styles.ratingText}>{ticket.service_rating}/5</Text>
              </View>
              {ticket.service_rating_note && (
                <Text style={styles.ratingNote}>"{ticket.service_rating_note}"</Text>
              )}
            </Card>
          </>
        )}

        {/* Histórico */}
        {events.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Histórico de Atualizações</Text>
            {events.map((ev) => (
              <View key={ev.id} style={styles.eventRow}>
                <View style={styles.eventRowHeader}>
                  <Text style={styles.eventStatus}>{STATUS_LABEL[ev.to_status as MaintenanceStatus] || ev.to_status}</Text>
                  <Text style={styles.eventDate}>{fmtDateTime(ev.created_at)}</Text>
                </View>
                {ev.notes && <Text style={styles.eventNotes}>{ev.notes}</Text>}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.default,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  card: {
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  titleText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    marginBottom: spacing.xs,
  },
  subLine: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginTop: 2,
  },
  subLineBold: {
    fontWeight: typography.weights.bold,
    color: colors.black,
  },
  delayCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    marginBottom: spacing.md,
  },
  delayHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  delayTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#991b1b',
  },
  delaySub: {
    fontSize: typography.sizes.xs,
    color: '#b91c1c',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  stepperCard: {
    marginBottom: spacing.md,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  stepItem: {
    alignItems: 'center',
    width: 66,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.input,
  },
  stepLabel: {
    fontSize: 10,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  responsibleOwner: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  responsibleTenant: {
    backgroundColor: '#fff7ed',
    borderColor: '#fcd34d',
  },
  responsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  responsibleTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  legalBasisBox: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  legalBasisText: {
    fontSize: typography.sizes.xs,
    color: colors.black,
    lineHeight: 16,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.sm,
  },
  infoBoxLabel: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoBoxValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.black,
    marginTop: 2,
  },
  infoBoxSub: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 2,
  },
  descText: {
    fontSize: typography.sizes.sm,
    color: colors.black,
    lineHeight: 20,
  },
  dateBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.sm,
  },
  dateBoxHighlight: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  mediaGroupLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.gray,
    marginBottom: spacing.xs,
  },
  mediaThumb: {
    width: 100,
    height: 80,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    backgroundColor: colors.bg.skeleton,
  },
  quotePendingCard: {
    backgroundColor: '#fffbeb',
    borderColor: colors.warning,
    borderWidth: 2,
    marginBottom: spacing.md,
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteAmount: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.black,
  },
  quoteActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.warning,
    borderStyle: 'dashed',
  },
  ratingCard: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
    marginBottom: spacing.md,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#78350f',
    marginLeft: spacing.xs,
  },
  ratingNote: {
    fontSize: typography.sizes.xs,
    color: '#92400e',
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  eventRow: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.orange,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  eventRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventStatus: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.black,
  },
  eventDate: {
    fontSize: 10,
    color: colors.gray,
  },
  eventNotes: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginTop: 2,
  },
  errorBox: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.sizes.base,
    color: colors.gray,
  },
});
