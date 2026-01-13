import { UserRepository } from '../repositories/userRepository';
import { PasswordService } from '../utils/password';
import { JwtService } from '../utils/jwt';
import { ErrorMessages } from '../utils/responses';
import { 
  User, 
  CreateUserData, 
  LoginInput, 
  ChangePasswordInput,
  UserRole 
} from '../models';

export class AuthService {
  /**
   * Registrar novo usuário
   */
  static async register(userData: CreateUserData): Promise<{
    user: Omit<User, 'password'>;
    tokens: { accessToken: string; refreshToken: string };
  }> {
    // Verificar se email já existe
    const existingUserByEmail = await UserRepository.findByEmail(userData.email);
    if (existingUserByEmail) {
      throw new Error(ErrorMessages.USER_EMAIL_EXISTS);
    }

    // Verificar se telefone já existe
    const existingUserByPhone = await UserRepository.findByPhone(userData.phone);
    if (existingUserByPhone) {
      throw new Error(ErrorMessages.USER_PHONE_EXISTS);
    }

    // Hash da senha
    const hashedPassword = await PasswordService.hashPassword(userData.password);

    // Criar usuário
    const user = await UserRepository.create({
      ...userData,
      password: hashedPassword,
      role: userData.role || UserRole.CLIENT,
    });

    // Gerar tokens
    const tokens = JwtService.generateTokenPair({
      user_id: user.id,
      email: user.email,
      role: user.role,
    });

    // Remover senha do retorno
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  /**
   * Login do usuário
   */
  static async login(credentials: LoginInput): Promise<{
    user: Omit<User, 'password'>;
    tokens: { accessToken: string; refreshToken: string };
  }> {
    // Buscar usuário por email
    const user = await UserRepository.findByEmail(credentials.email);
    if (!user) {
      throw new Error(ErrorMessages.INVALID_CREDENTIALS);
    }

    // Verificar senha
    if (!user.password) {
      throw new Error(ErrorMessages.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await PasswordService.comparePassword(
      credentials.password,
      user.password
    );

    if (!isPasswordValid) {
      throw new Error(ErrorMessages.INVALID_CREDENTIALS);
    }

    // Gerar tokens
    const tokens = JwtService.generateTokenPair({
      user_id: user.id,
      email: user.email,
      role: user.role,
    });

    // Remover senha do retorno
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  /**
   * Renovar access token usando refresh token
   */
  static async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      // Verificar refresh token
      const decoded = JwtService.verifyRefreshToken(refreshToken);

      // Buscar usuário para garantir que ainda existe e está ativo
      const user = await UserRepository.findById(decoded.user_id);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Gerar novos tokens
      return JwtService.generateTokenPair({
        user_id: user.id,
        email: user.email,
        role: user.role,
      });
    } catch (error: any) {
      throw new Error(ErrorMessages.REFRESH_TOKEN_INVALID);
    }
  }

  /**
   * Alterar senha do usuário
   */
  static async changePassword(
    userId: string,
    passwordData: ChangePasswordInput
  ): Promise<void> {
    // Buscar usuário
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error(ErrorMessages.USER_NOT_FOUND);
    }

    // Buscar usuário com senha para validação
    const userWithPassword = await UserRepository.findByEmail(user.email);
    if (!userWithPassword?.password) {
      throw new Error(ErrorMessages.USER_NOT_FOUND);
    }

    // Verificar senha atual
    const isCurrentPasswordValid = await PasswordService.comparePassword(
      passwordData.current_password,
      userWithPassword.password
    );

    if (!isCurrentPasswordValid) {
      throw new Error(ErrorMessages.CURRENT_PASSWORD_INVALID);
    }

    // Hash da nova senha
    const hashedNewPassword = await PasswordService.hashPassword(
      passwordData.new_password
    );

    // Atualizar senha no banco
    const success = await UserRepository.updatePassword(userId, hashedNewPassword);
    if (!success) {
      throw new Error('Erro ao atualizar senha');
    }
  }

  /**
   * Buscar perfil do usuário autenticado
   */
  static async getProfile(userId: string): Promise<Omit<User, 'password'>> {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error(ErrorMessages.USER_NOT_FOUND);
    }

    // Remover senha se existir
    const { password, ...userWithoutPassword } = user as any;
    return userWithoutPassword;
  }

  /**
   * Atualizar perfil do usuário autenticado
   */
  static async updateProfile(
    userId: string,
    updateData: { name?: string; phone?: string }
  ): Promise<Omit<User, 'password'>> {
    // Verificar se telefone já existe (se está sendo alterado)
    if (updateData.phone) {
      const phoneExists = await UserRepository.phoneExists(updateData.phone, userId);
      if (phoneExists) {
        throw new Error(ErrorMessages.USER_PHONE_EXISTS);
      }
    }

    // Atualizar usuário
    const updatedUser = await UserRepository.update(userId, updateData);
    if (!updatedUser) {
      throw new Error(ErrorMessages.USER_NOT_FOUND);
    }

    // Remover senha do retorno
    const { password, ...userWithoutPassword } = updatedUser as any;
    return userWithoutPassword;
  }

  /**
   * Validar token de acesso
   */
  static async validateAccessToken(token: string): Promise<{
    user_id: string;
    email: string;
    role: UserRole;
  }> {
    try {
      const decoded = JwtService.verifyAccessToken(token);
      
      // Verificar se usuário ainda existe e está ativo
      const user = await UserRepository.findById(decoded.user_id);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      return {
        user_id: decoded.user_id,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (error: any) {
      throw new Error(ErrorMessages.TOKEN_INVALID);
    }
  }

  /**
   * Logout (invalidar tokens no cliente)
   * Nota: Em uma implementação mais robusta, poderíamos manter uma blacklist de tokens
   */
  static async logout(): Promise<void> {
    // Em uma implementação real, aqui poderíamos:
    // 1. Adicionar o token a uma blacklist no Redis
    // 2. Incrementar a versão do refresh token no banco
    // 3. Registrar o logout no log de auditoria
    
    // Por enquanto, apenas retornamos sucesso
    // O cliente deve remover os tokens do storage local
    return;
  }

  /**
   * Gerar senha temporária para reset
   */
  static async generateTemporaryPassword(email: string): Promise<string> {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw new Error(ErrorMessages.USER_NOT_FOUND);
    }

    // Gerar senha temporária
    const tempPassword = PasswordService.generateTemporaryPassword();
    
    // Hash da senha temporária
    const hashedPassword = await PasswordService.hashPassword(tempPassword);
    
    // Atualizar senha no banco
    const success = await UserRepository.updatePassword(user.id, hashedPassword);
    if (!success) {
      throw new Error('Erro ao gerar senha temporária');
    }

    return tempPassword;
  }

  /**
   * Verificar se usuário tem permissões específicas
   */
  static hasPermission(userRole: UserRole, requiredRoles: UserRole[]): boolean {
    return requiredRoles.includes(userRole);
  }

  /**
   * Verificar se usuário é admin
   */
  static isAdmin(userRole: UserRole): boolean {
    return userRole === UserRole.ADMIN;
  }

  /**
   * Verificar se usuário é barbeiro ou admin
   */
  static isBarberOrAdmin(userRole: UserRole): boolean {
    return [UserRole.BARBER, UserRole.ADMIN].includes(userRole);
  }
}