import bcrypt from 'bcrypt';
import { config } from '../config';

export class PasswordService {
  /**
   * Gera hash da senha
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(config.bcrypt.rounds);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      throw new Error('Erro ao gerar hash da senha');
    }
  }

  /**
   * Compara senha com hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new Error('Erro ao comparar senha');
    }
  }

  /**
   * Valida força da senha
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
    strength: 'weak' | 'medium' | 'strong';
  } {
    const errors: string[] = [];
    let score = 0;

    // Comprimento mínimo
    if (password.length < 8) {
      errors.push('Senha deve ter pelo menos 8 caracteres');
    } else {
      score += 1;
    }

    // Letra maiúscula
    if (!/[A-Z]/.test(password)) {
      errors.push('Senha deve conter pelo menos uma letra maiúscula');
    } else {
      score += 1;
    }

    // Letra minúscula
    if (!/[a-z]/.test(password)) {
      errors.push('Senha deve conter pelo menos uma letra minúscula');
    } else {
      score += 1;
    }

    // Número
    if (!/\d/.test(password)) {
      errors.push('Senha deve conter pelo menos um número');
    } else {
      score += 1;
    }

    // Caractere especial
    if (!/[@$!%*?&]/.test(password)) {
      errors.push('Senha deve conter pelo menos um caractere especial (@$!%*?&)');
    } else {
      score += 1;
    }

    // Determinar força
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    if (score >= 4) strength = 'strong';
    else if (score >= 3) strength = 'medium';

    return {
      isValid: errors.length === 0,
      errors,
      strength,
    };
  }

  /**
   * Gera senha temporária
   */
  static generateTemporaryPassword(length: number = 12): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '@$!%*?&';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // Garantir pelo menos um caractere de cada tipo
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Preencher o restante aleatoriamente
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Embaralhar a senha
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}