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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { safeNotificationAsync } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/services/supabase';
import { showAlert } from '@/utils/crossAlert';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { validateImageFile } from '@/utils/uploadValidator';
import { MaintenanceCategory, MaintenancePriority, MaintenanceTriageRuleRow } from '@/types/database';

const CATEGORIES: { label: string; value: MaintenanceCategory }[] = [
  { label: 'Hidráulica', value: 'hidraulica' },
  { label: 'Elétrica', value: 'eletrica' },
  { label: 'Estrutural', value: 'estrutural' },
  { label: 'Pintura', value: 'pintura' },
  { label: 'Esquadrias / Janelas', value: 'esquadrias' },
  { label: 'Portas e Fechaduras', value: 'portas_fechaduras' },
  { label: 'Ar-condicionado', value: 'ar_condicionado' },
  { label: 'Outro', value: 'outro' },
];

const RESPONSIBLE_LABEL: Record<string, string> = {
  owner: 'Proprietário',
  tenant: 'Locatário',
  condo: 'Condomínio',
  technical_inspection: 'Vistoria técnica necessária',
};

const PRIORITIES: { label: string; value: MaintenancePriority; color: string }[] = [
  { label: 'Baixa', value: 'baixa', color: colors.info },
  { label: 'Normal', value: 'normal', color: colors.gray },
  { label: 'Alta', value: 'alta', color: colors.warning },
  { label: 'Urgente', value: 'urgente', color: colors.error },
];

interface SelectableProperty {
  id: string;
  title: string;
}

export default function NovaManutencaoScreen() {
  const { propertyId: paramPropertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [properties, setProperties] = useState<SelectableProperty[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(paramPropertyId || '');
  const [category, setCategory] = useState<MaintenanceCategory>('hidraulica');
  const [priority, setPriority] = useState<MaintenancePriority>('normal');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Triagem legal (mesmas regras do site: maintenance_triage_rules) ──
  const [triageRules, setTriageRules] = useState<MaintenanceTriageRuleRow[]>([]);
  const [triageAnswers, setTriageAnswers] = useState<Record<string, 'sim' | 'nao'>>({});
  const [currentQuestionKey, setCurrentQuestionKey] = useState<string | null>(null);
  const [triageResult, setTriageResult] = useState<{ party: string; legalBasis: string | null } | null>(null);

  useEffect(() => {
    if (user) loadProperties();
  }, [user]);

  useEffect(() => {
    loadTriageRules(category);
  }, [category]);

  async function loadTriageRules(cat: MaintenanceCategory) {
    setTriageAnswers({});
    setTriageResult(null);
    const { data } = await supabase
      .from('maintenance_triage_rules')
      .select('*')
      .eq('category', cat)
      .eq('active', true)
      .order('display_order', { ascending: true });

    const rules = (data || []) as MaintenanceTriageRuleRow[];
    setTriageRules(rules);
    setCurrentQuestionKey(rules[0]?.question_key ?? null);
  }

  function handleTriageAnswer(rule: MaintenanceTriageRuleRow, answer: 'sim' | 'nao') {
    const nextAnswers = { ...triageAnswers, [rule.question_key]: answer };
    setTriageAnswers(nextAnswers);

    const leads = answer === 'sim' ? rule.answer_yes_leads : rule.answer_no_leads;
    const legalBasis = answer === 'sim' ? rule.legal_basis_yes : rule.legal_basis_no;

    if (leads.startsWith('next:')) {
      setCurrentQuestionKey(leads.slice(5));
    } else {
      setTriageResult({ party: leads, legalBasis });
      setCurrentQuestionKey(null);
    }
  }

  function handleRedoTriage() {
    setTriageAnswers({});
    setTriageResult(null);
    setCurrentQuestionKey(triageRules[0]?.question_key ?? null);
  }

  async function loadProperties() {
    const [{ data: owned }, { data: rented }] = await Promise.all([
      supabase.from('properties').select('id, title').eq('owner_id', user!.id),
      supabase
        .from('contracts')
        .select('property:properties(id, title)')
        .eq('tenant_id', user!.id)
        .eq('status', 'ativo'),
    ]);

    const ownedList: SelectableProperty[] = owned || [];
    const rentedList: SelectableProperty[] = (rented || [])
      .map((c: any) => c.property)
      .filter(Boolean);

    const merged = [...ownedList, ...rentedList].filter(
      (p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx
    );

    setProperties(merged);
    if (!selectedPropertyId && merged.length > 0) {
      setSelectedPropertyId(merged[0].id);
    }
  }

  async function handlePickImages() {
    if (selectedImages.length >= 5) {
      showAlert('Limite atingido', 'Você pode enviar no máximo 5 fotos por chamado.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
        selectionLimit: 5 - selectedImages.length,
      });

      if (!result.canceled && result.assets) {
        const validUris: string[] = [];

        for (const file of result.assets) {
          const validation = validateImageFile({
            mimeType: file.mimeType,
            fileSize: file.fileSize,
          });

          if (validation.valid) {
            validUris.push(file.uri);
          } else {
            showAlert('Arquivo ignorado', validation.errorMessage);
          }
        }

        setSelectedImages((prev) => [...prev, ...validUris]);
      }
    } catch (err) {
      showAlert('Erro', 'Falha ao selecionar fotos.');
    }
  }

  function handleRemoveImage(index: number) {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!selectedPropertyId) {
      showAlert('Imóvel necessário', 'Selecione o imóvel relacionado ao chamado.');
      return;
    }
    if (title.trim().length < 5) {
      showAlert('Título muito curto', 'O título precisa ter pelo menos 5 caracteres.');
      return;
    }
    if (description.trim().length < 10) {
      showAlert('Descrição muito curta', 'Descreva o problema com pelo menos 10 caracteres.');
      return;
    }

    setLoading(true);

    try {
      // 1. Cria o chamado via RPC — a mesma função que o site usa. Ela resolve
      // reporter_role, contrato e responsabilidade legal no servidor.
      const { data: requestId, error } = await supabase.rpc('create_maintenance_request', {
        p_property_id: selectedPropertyId,
        p_title: title.trim(),
        p_description: description.trim(),
        p_category: category,
        p_priority: priority,
        p_triage_answers: Object.keys(triageAnswers).length > 0 ? triageAnswers : null,
        p_problem_start: null,
        p_is_urgent: priority === 'urgente',
        p_draft_id: null,
      });

      if (error || !requestId) {
        showAlert('Erro ao abrir chamado', error?.message || 'Não foi possível registrar a solicitação.');
        return;
      }

      // 2. Upload das fotos direto pro pedido já criado (bucket privado).
      for (let i = 0; i < selectedImages.length; i++) {
        const uri = selectedImages[i];
        const fileExt = uri.split('.').pop() || 'jpg';
        const path = `${selectedPropertyId}/${requestId}/before/${Date.now()}_${i}.${fileExt}`;

        const response = await fetch(uri);
        const blob = await response.blob();

        const { error: uploadErr } = await supabase.storage
          .from('maintenance-media')
          .upload(path, blob, { upsert: true });

        if (!uploadErr) {
          await supabase.from('maintenance_media').insert({
            request_id: requestId,
            uploader_id: user!.id,
            stage: 'before',
            storage_path: path,
            mime_type: blob.type || 'image/jpeg',
          });
        }
      }

      safeNotificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Chamado Registrado! 🔧', 'Sua solicitação foi enviada para análise.', [
        { text: 'Ver Meus Chamados', onPress: () => router.replace('/manutencao') },
      ]);
    } catch (err) {
      showAlert('Erro', 'Ocorreu um erro ao enviar o chamado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Novo Chamado" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Card style={styles.formCard}>
          {/* Seleção de Imóvel */}
          <Text style={styles.fieldLabel}>Imóvel</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {properties.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, selectedPropertyId === p.id && styles.chipActive]}
                onPress={() => setSelectedPropertyId(p.id)}
              >
                <Text style={[styles.chipText, selectedPropertyId === p.id && styles.chipTextActive]} numberOfLines={1}>
                  {p.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {properties.length === 0 && (
            <Text style={styles.hintText}>
              Você precisa possuir ou alugar um imóvel ativo para abrir um chamado.
            </Text>
          )}

          {/* Seleção de Categoria */}
          <Text style={styles.fieldLabel}>Categoria do Problema</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.chip, category === cat.value && styles.chipActive]}
                onPress={() => setCategory(cat.value)}
              >
                <Text style={[styles.chipText, category === cat.value && styles.chipTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Triagem legal — mesmas perguntas do site, definem o responsável automaticamente */}
          {triageRules.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>Triagem de Responsabilidade</Text>

              {!triageResult && currentQuestionKey && (
                <View style={styles.triageCard}>
                  <Text style={styles.triageQuestion}>
                    {triageRules.find((r) => r.question_key === currentQuestionKey)?.question_text}
                  </Text>
                  <View style={styles.triageButtonsRow}>
                    <TouchableOpacity
                      style={styles.triageButtonNo}
                      onPress={() => {
                        const rule = triageRules.find((r) => r.question_key === currentQuestionKey);
                        if (rule) handleTriageAnswer(rule, 'nao');
                      }}
                    >
                      <Text style={styles.triageButtonNoText}>Não</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.triageButtonYes}
                      onPress={() => {
                        const rule = triageRules.find((r) => r.question_key === currentQuestionKey);
                        if (rule) handleTriageAnswer(rule, 'sim');
                      }}
                    >
                      <Text style={styles.triageButtonYesText}>Sim</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {triageResult && (
                <View style={styles.triageResultCard}>
                  <View style={styles.triageResultHeader}>
                    <MaterialCommunityIcons name="gavel" size={18} color={colors.blue} />
                    <Text style={styles.triageResultTitle}>
                      Responsável identificado: {RESPONSIBLE_LABEL[triageResult.party] || triageResult.party}
                    </Text>
                  </View>
                  {triageResult.legalBasis && (
                    <Text style={styles.triageResultBasis}>{triageResult.legalBasis}</Text>
                  )}
                  <TouchableOpacity onPress={handleRedoTriage}>
                    <Text style={styles.triageRedoLink}>Refazer triagem</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* Seleção de Prioridade */}
          <Text style={styles.fieldLabel}>Nível de Urgência</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.priorityChip,
                  priority === p.value && { backgroundColor: p.color, borderColor: p.color },
                ]}
                onPress={() => setPriority(p.value)}
              >
                <Text style={[styles.priorityText, priority === p.value && styles.priorityTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Título */}
          <Input
            label="Título do chamado"
            placeholder="Ex: Vazamento na pia do banheiro"
            value={title}
            onChangeText={setTitle}
            containerStyle={{ marginTop: spacing.md }}
          />

          {/* Descrição */}
          <Input
            label="Descrição do problema"
            placeholder="Descreva o problema com detalhes..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          {/* Fotos */}
          <Text style={styles.fieldLabel}>Fotos do problema (opcional)</Text>
          <View style={styles.photosRow}>
            {selectedImages.map((uri, index) => (
              <View key={index} style={styles.photoWrapper}>
                <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                <TouchableOpacity style={styles.removePhotoButton} onPress={() => handleRemoveImage(index)}>
                  <MaterialCommunityIcons name="close" size={14} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            {selectedImages.length < 5 && (
              <TouchableOpacity style={styles.addPhotoButton} onPress={handlePickImages}>
                <MaterialCommunityIcons name="camera-plus-outline" size={24} color={colors.gray} />
              </TouchableOpacity>
            )}
          </View>

          <Button
            label="Enviar Chamado"
            onPress={handleSubmit}
            loading={loading}
            fullWidth
            style={styles.submitButton}
          />
        </Card>
      </ScrollView>
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
  formCard: {
    padding: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.black,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  hintText: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginBottom: spacing.sm,
  },
  triageCard: {
    backgroundColor: colors.bg.input,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  triageQuestion: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.black,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  triageButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  triageButtonNo: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  triageButtonNoText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.black,
  },
  triageButtonYes: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.navy,
    alignItems: 'center',
  },
  triageButtonYesText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
  triageResultCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  triageResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  triageResultTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#1d4ed8',
    flex: 1,
  },
  triageResultBasis: {
    fontSize: typography.sizes.xs,
    color: colors.black,
    lineHeight: 16,
    marginTop: spacing.sm,
  },
  triageRedoLink: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.blue,
    marginTop: spacing.sm,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bg.input,
    marginRight: spacing.sm,
    maxWidth: 200,
  },
  chipActive: {
    backgroundColor: colors.navy,
  },
  chipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.gray,
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.input,
    alignItems: 'center',
  },
  priorityText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.gray,
  },
  priorityTextActive: {
    color: colors.white,
  },
  photosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoWrapper: {
    position: 'relative',
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.bg.skeleton,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButton: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    marginTop: spacing.xl,
  },
});
