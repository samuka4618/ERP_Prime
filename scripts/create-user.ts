import { UserModel } from '../src/core/users/User';
import { AuthService } from '../src/core/auth/AuthService';
import { CreateUserRequest, UserRole } from '../src/shared/types';

async function createUser() {
  const userData: CreateUserRequest = {
    name: 'Samuel',
    email: 'samuel.nassilva@gmail.com',
    password: '46184635Avs1978$',
    role: UserRole.ADMIN,
    is_active: true
  };
  
  console.log(`\n🔨 Criando usuário: ${userData.email}\n`);
  
  try {
    // Verificar se o usuário já existe
    const existingUser = await UserModel.findByEmail(userData.email);
    
    if (existingUser) {
      console.log('⚠️  Usuário já existe!');
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Nome: ${existingUser.name}`);
      console.log(`   Ativo: ${existingUser.is_active ? 'Sim' : 'Não'}`);
      
      if (!existingUser.is_active) {
        console.log('\n🔄 Reativando usuário...');
        await UserModel.update(existingUser.id, { is_active: true });
        await UserModel.updatePassword(existingUser.id, userData.password);
        console.log('✅ Usuário reativado com sucesso!');
      } else {
        console.log('\n🔄 Atualizando senha...');
        await UserModel.updatePassword(existingUser.id, userData.password);
        console.log('✅ Senha atualizada com sucesso!');
      }
      
      const updatedUser = await UserModel.findById(existingUser.id);
      if (updatedUser) {
        console.log('\n✅ Usuário atualizado:');
        console.log(`   ID: ${updatedUser.id}`);
        console.log(`   Nome: ${updatedUser.name}`);
        console.log(`   Email: ${updatedUser.email}`);
        console.log(`   Role: ${updatedUser.role}`);
        console.log(`   Ativo: ${updatedUser.is_active ? 'Sim' : 'Não'}`);
      }
    } else {
      // Validar senha
      const passwordValidation = AuthService.validatePassword(userData.password);
      if (!passwordValidation.isValid) {
        console.error('❌ Senha inválida:');
        passwordValidation.errors.forEach(error => console.error(`   - ${error}`));
        return;
      }
      
      // Criar usuário
      const user = await UserModel.create(userData);
      
      console.log('✅ Usuário criado com sucesso!');
      console.log(`   ID: ${user.id}`);
      console.log(`   Nome: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Ativo: ${user.is_active ? 'Sim' : 'Não'}`);
    }
    
    console.log('\n🎉 Pronto! Agora você pode fazer login.');
    
  } catch (error) {
    console.error('❌ Erro ao criar/atualizar usuário:', error);
    if (error instanceof Error) {
      console.error('   Mensagem:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
  
  process.exit(0);
}

createUser();

