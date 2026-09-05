import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { safeImpactAsync, safeNotificationAsync } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { fetchPropertyById } from '@/services/propertyService';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { MoveInDatePicker } from '@/components/shared/MoveInDatePicker';
import { supabase } from '@/services/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { formatPrice } from '@/utils/format';
import { showAlert } from '@/utils/crossAlert';
import { PropertyCardItem } from '@/types/app';

type ProposalIntent = 'aceitar' | 'negociar';

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Mesmas regras de perfil completo exigidas pela API web (POST /api/proposals). */
function getMissingProfileFields(
  profile: { full_name?: string | null; phone?: string | null; cpf_cnpj?: string | null } | null,
  emailConfirmedAt: string | null | undefined
): string[] {
  const missing: string[] = [];
  if (!profile?.full_name?.trim()) missing.push('nome completo');
  if (!profile?.phone?.trim()) missing.push('telefone');
  if (!profile?.cpf_cnpj?.trim()) missing.push('CPF/CNPJ');
  if (!emailConfirmedAt) missing.push('confirmação de e-mail');
  return missing;
}

export default function PropostaScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [property, setProperty] = useState<PropertyCardItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [proposedMoveIn, setProposedMoveIn] = useState<Date | null>(null);
  const [intent, setIntent] = useState<ProposalIntent | null>(null);
  const [proposedRentInput, setProposedRentInput] = useState('');
  const [negotiationMessage, setNegotiationMessage] = useState('');

  useEffect(() => {
    if (propertyId) loadProperty();
  }, [propertyId]);

  async function loadProperty() {
    setLoading(true);
    const data = await fetchPropertyById(propertyId);
    setProperty(data);
    setLoading(false);
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Manifesto de Interesse" showBack />
        <Card style={styles.cardPadding}>
          <Text style={styles.cardTitle}>Login necessário</Text>
          <Text style={styles.cardSub}>Você precisa estar autenticado para manifestar interesse neste imóvel.</Text>
          <Button label="Fazer Login" onPress={() => router.push('/(auth)/login')} fullWidth style={{ marginTop: spacing.md }} />
        </Card>
      </SafeAreaView>
    );
  }

  if (loading) {
    return <LoadingSpinner fullScreen message="Carregando dados do imóvel..." />;
  }

  const missingFields = getMissingProfileFields(profile, user.email_confirmed_at);

  if (missingFields.length > 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Manifesto de Interesse" showBack />
        <Card style={styles.cardPadding}>
          <MaterialCommunityIcons name="account-alert-outline" size={32} color={colors.orange} />
          <Text style={styles.cardTitle}>Complete seu cadastro</Text>
          <Text style={styles.cardSub}>
            Antes de manifestar interesse, complete: {missingFields.join(', ')}.
          </Text>
          <Button
            label="Completar cadastro"
            onPress={() => router.push('/(tabs)/perfil')}
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </SafeAreaView>
    );
  }

  async function handleSubmit() {
    if (!proposedMoveIn) {
      showAlert('Data obrigatória', 'Selecione a data desejada de entrada.');
      return;
    }
    if (!intent) {
      showAlert('Escolha uma opção', 'Selecione como deseja prosseguir com o imóvel.');
      return;
    }
    if (intent === 'negociar' && !negotiationMessage.trim()) {
      showAlert('Mensagem obrigatória', 'Descreva sua solicitação de ajuste ou negociação.');
      return;
    }

    setSubmitting(true);
    try {
      const parsedRent = proposedRentInput ? Number(proposedRentInput.replace(/\D/g, '')) : undefined;
      const finalProposedRent = intent === 'negociar' && parsedRent && parsedRent > 0 ? parsedRent : null;
      const message =
        intent === 'negociar' ? `[Solicitação de ajuste] ${negotiationMessage.trim()}` : null;

      const { data: rpcResult, error: rpcError } = await supabase.rpc('create_proposal_v2', {
        p_property_id: propertyId,
        p_message: message,
        p_proposed_move_in: toISODate(proposedMoveIn),
        p_proposed_rent: finalProposedRent,
      });

      if (rpcError) {
        const hint = (rpcError as { hint?: string }).hint;
        if (hint === 'RATE_LIMIT') {
          showAlert(
            'Limite atingido',
            'Você atingiu o limite de 5 propostas ativas simultâneas. Aguarde a conclusão de alguma antes de enviar uma nova.'
          );
        } else if (hint === 'DUPLICATE_PROPOSAL' || rpcError.code === '23505') {
          showAlert('Proposta já existe', 'Você já tem uma proposta ativa para este imóvel.');
        } else {
          showAlert('Erro ao enviar', rpcError.message || 'Falha ao criar proposta.');
        }
        return;
      }

      const initialStatus = rpcResult?.initial_status as string | undefined;
      const proposalId = rpcResult?.proposal_id as string | undefined;

      // Notificação in-app pro proprietário (mesma RPC que a API web usa).
      if (property?.owner_id && proposalId) {
        const propertyAddress = [property.address_street, property.address_city]
          .filter(Boolean)
          .join(', ') || property.title || 'Imóvel';

        const { error: notifError } = await supabase.rpc('insert_proposal_notification', {
          p_owner_id: property.owner_id,
          p_property_address: propertyAddress,
          p_proposal_id: proposalId,
          p_property_id: propertyId,
        });
        if (notifError) {
          console.warn('[proposta] Falha ao criar notificação in-app:', notifError.message);
        }
      }

      safeNotificationAsync(Haptics.NotificationFeedbackType.Success);

      const successMessage =
        initialStatus === 'auto_aprovado'
          ? 'Sua proposta foi aprovada automaticamente! Um contrato já está sendo gerado.'
          : initialStatus === 'aguardando_proprietario'
            ? 'Sua proposta foi enviada. O proprietário vai analisar e decidir.'
            : 'Sua proposta foi registrada com sucesso. O proprietário será notificado.';

      showAlert('Interesse enviado 🎉', successMessage, [
        { text: 'Ir para Minha Área', onPress: () => router.replace('/(tabs)/dashboard') },
      ]);
    } catch (err) {
      showAlert('Erro', 'Ocorreu uma falha ao registrar seu interesse.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Manifesto de Interesse" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Resumo do Imóvel */}
        <Card style={styles.propertySummaryCard}>
          <Text style={styles.summaryTitle} numberOfLines={1}>
            {property?.title}
          </Text>
          <Text style={styles.summaryPrice}>
            Valor pedido: {formatPrice(property?.rent_amount)}/mês
          </Text>
        </Card>

        <View style={styles.stepBox}>
          <Text style={styles.fieldLabel}>Data desejada de entrada *</Text>
          <MoveInDatePicker
            value={proposedMoveIn}
            onChange={setProposedMoveIn}
            minimumDate={new Date()}
          />

          <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Como deseja prosseguir? *</Text>

          <TouchableOpacity
            style={[styles.intentCard, intent === 'aceitar' && styles.intentCardSelectedAccept]}
            onPress={() => {
              safeImpactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIntent('aceitar');
            }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={22}
              color={intent === 'aceitar' ? colors.orange : colors.gray}
            />
            <View style={styles.intentTextCol}>
              <Text style={styles.intentTitle}>Aceitar condições do anúncio</Text>
              <Text style={styles.intentSub}>
                Concordo com o valor, regras e condições descritas no anúncio.
              </Text>
            </View>
            {intent === 'aceitar' && (
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.orange} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.intentCard, intent === 'negociar' && styles.intentCardSelected]}
            onPress={() => {
              safeImpactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIntent('negociar');
            }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="pencil-outline"
              size={22}
              color={intent === 'negociar' ? colors.blue : colors.gray}
            />
            <View style={styles.intentTextCol}>
              <Text style={styles.intentTitle}>Negociar valor ou pedir ajuste</Text>
              <Text style={styles.intentSub}>
                Quero propor uma alteração no valor ou nas condições do anúncio.
              </Text>
            </View>
            {intent === 'negociar' && (
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.blue} />
            )}
          </TouchableOpacity>

          {intent === 'negociar' && (
            <View style={styles.negotiationFields}>
              <Input
                label="Valor proposto (R$/mês) — opcional"
                placeholder={property?.rent_amount?.toString()}
                value={proposedRentInput}
                onChangeText={setProposedRentInput}
                type="currency"
                leftIcon="currency-brl"
              />
              <Input
                label="Justificativa ou pedido de ajuste *"
                placeholder="Explique o que gostaria de negociar..."
                value={negotiationMessage}
                onChangeText={setNegotiationMessage}
                multiline
                numberOfLines={4}
                maxLength={500}
                hint={`${negotiationMessage.length}/500`}
              />
            </View>
          )}

          <Text style={styles.consentNote}>
            Ao enviar, o proprietário e a equipe da Clicou Alugou serão notificados. Você poderá
            acompanhar o status da sua proposta no painel.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footerRow}>
        <Button label="Cancelar" onPress={() => router.back()} variant="secondary" style={{ flex: 1 }} />
        <Button label="Enviar Proposta" onPress={handleSubmit} loading={submitting} style={{ flex: 1.5 }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.default,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  propertySummaryCard: {
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.navy,
  },
  summaryPrice: {
    fontSize: typography.sizes.sm,
    color: colors.cyan,
    fontWeight: typography.weights.semibold,
    marginTop: 2,
  },
  stepBox: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.black,
    marginBottom: spacing.sm,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  dateButtonText: {
    fontSize: typography.sizes.base,
    color: colors.black,
  },
  dateButtonPlaceholder: {
    color: colors.gray,
  },
  intentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.white,
    marginBottom: spacing.sm,
  },
  intentCardSelected: {
    borderColor: colors.blue,
    backgroundColor: colors.bg.tenant,
  },
  intentCardSelectedAccept: {
    borderColor: colors.orange,
    backgroundColor: 'rgba(255, 75, 38, 0.06)',
  },
  intentTextCol: {
    flex: 1,
  },
  intentTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.navy,
  },
  intentSub: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginTop: 2,
    lineHeight: 16,
  },
  negotiationFields: {
    marginTop: spacing.sm,
  },
  consentNote: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginTop: spacing.md,
    lineHeight: 16,
  },
  cardPadding: {
    margin: spacing.lg,
    padding: spacing.xl,
  },
  cardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    marginTop: spacing.sm,
  },
  cardSub: {
    fontSize: typography.sizes.sm,
    color: colors.gray,
    marginTop: spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing.md,
  },
});
