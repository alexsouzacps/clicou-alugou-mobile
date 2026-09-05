import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '@/services/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { handleSupabaseError } from '@/utils/errorHandler';
import { isValidEmail, isValidCPF, isValidPassword, isValidPhone } from '@/utils/validation';
import { useOnboardingStore } from '@/store/onboardingStore';
import { ProfileRole } from '@/types/database';

export default function CadastroScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const initialRole: ProfileRole = params.role === 'proprietario' ? 'proprietario' : 'locatario';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<ProfileRole>(initialRole);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!fullName.trim() || !email.trim() || !password.trim() || !cpf.trim() || !phone.trim()) {
      Alert.alert('Campos obrigatórios', 'Por favor, preencha todos os campos.');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert(
        'Termos de Uso',
        'Para criar sua conta, você precisa aceitar os Termos de Uso e a Política de Privacidade.'
      );
      return;
    }

    if (fullName.trim().split(' ').length < 2) {
      Alert.alert('Nome inválido', 'Por favor, informe seu nome completo.');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('E-mail inválido', 'Por favor, informe um endereço de e-mail válido.');
      return;
    }

    const passValidation = isValidPassword(password);
    if (!passValidation.valid) {
      Alert.alert('Senha fraca', passValidation.message);
      return;
    }

    if (!isValidCPF(cpf)) {
      Alert.alert('CPF inválido', 'Por favor, informe um CPF válido.');
      return;
    }

    if (!isValidPhone(phone)) {
      Alert.alert('Telefone inválido', 'Por favor, informe um número de telefone com DDD.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            cpf_cnpj: cpf.replace(/\D/g, ''),
            role: role,
          },
        },
      });

      if (error) {
        Alert.alert('Erro no cadastro', handleSupabaseError(error));
        return;
      }

      if (data.session) {
        useOnboardingStore.getState().setIsGuest(false);
        Alert.alert('Sucesso 🎉', 'Conta criada com sucesso!', [
          { text: 'Acessar a Plataforma', onPress: () => router.replace('/(tabs)') },
        ]);
      } else {
        Alert.alert(
          'Conta Criada! 📩',
          'Enviamos um e-mail de confirmação. Por favor, verifique sua caixa de entrada.',
          [{ text: 'Voltar ao Login', onPress: () => router.replace('/(auth)/login') }]
        );
      }
    } catch (err) {
      Alert.alert('Erro', 'Ocorreu um erro inesperado ao cadastrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="Criar nova conta" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          <Text style={styles.subtitle}>
            Junte-se à maior plataforma de aluguel digital sem burocracia.
          </Text>

          {/* Seleção de Papel */}
          <Text style={styles.roleLabel}>Qual é o seu objetivo principal?</Text>
          <View style={styles.roleSelector}>
            <TouchableOpacity
              style={[
                styles.roleOption,
                role === 'locatario' && styles.roleOptionSelectedTenant,
              ]}
              onPress={() => setRole('locatario')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="key"
                size={22}
                color={role === 'locatario' ? colors.cyan : colors.gray}
              />
              <Text
                style={[
                  styles.roleOptionText,
                  role === 'locatario' && styles.roleOptionTextSelected,
                ]}
              >
                Quero alugar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleOption,
                role === 'proprietario' && styles.roleOptionSelectedOwner,
              ]}
              onPress={() => setRole('proprietario')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="home-city"
                size={22}
                color={role === 'proprietario' ? colors.success : colors.gray}
              />
              <Text
                style={[
                  styles.roleOptionText,
                  role === 'proprietario' && styles.roleOptionTextSelected,
                ]}
              >
                Sou proprietário
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <Input
            label="Nome completo"
            placeholder="Ex: João Silva Sauro"
            value={fullName}
            onChangeText={setFullName}
            leftIcon="account-outline"
          />

          <Input
            label="E-mail"
            placeholder="seu.email@exemplo.com"
            value={email}
            onChangeText={setEmail}
            type="email"
            leftIcon="email-outline"
          />

          <Input
            label="CPF"
            placeholder="000.000.000-00"
            value={cpf}
            onChangeText={setCpf}
            type="cpf"
            leftIcon="card-account-details-outline"
          />

          <Input
            label="Celular / WhatsApp"
            placeholder="(11) 99999-9999"
            value={phone}
            onChangeText={setPhone}
            type="phone"
            leftIcon="phone-outline"
          />

          <Input
            label="Senha"
            placeholder="Mín. 8 chars, 1 maiúscula, 1 número"
            value={password}
            onChangeText={setPassword}
            type="password"
            leftIcon="lock-outline"
          />

          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setAcceptedTerms((v) => !v)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={acceptedTerms ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={22}
              color={acceptedTerms ? colors.cyan : colors.gray}
            />
            <Text style={styles.termsText}>
              Li e aceito os Termos de Uso e a Política de Privacidade.
            </Text>
          </TouchableOpacity>

          <Button
            label="Concluir Cadastro"
            onPress={handleRegister}
            loading={loading}
            fullWidth
            style={styles.submitButton}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Já possui uma conta?</Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.loginLink}>Entrar com minha conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg.default,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  roleLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.black,
    marginBottom: spacing.sm,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.input,
    gap: spacing.xs,
  },
  roleOptionSelectedTenant: {
    borderColor: colors.cyan,
    backgroundColor: colors.bg.tenant,
  },
  roleOptionSelectedOwner: {
    borderColor: colors.success,
    backgroundColor: colors.bg.owner,
  },
  roleOptionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray,
  },
  roleOptionTextSelected: {
    fontWeight: typography.weights.bold,
    color: colors.black,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  termsText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.gray,
    lineHeight: 16,
  },
  submitButton: {
    marginTop: spacing.md,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.gray,
  },
  loginLink: {
    fontSize: typography.sizes.sm,
    color: colors.cyan,
    fontWeight: typography.weights.bold,
    marginTop: spacing.xs,
  },
});
