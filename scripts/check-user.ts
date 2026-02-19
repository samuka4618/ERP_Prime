import { UserModel } from '../src/core/users/User';
import { AuthService } from '../src/core/auth/AuthService';

async function checkUser() {
  const email = 'samuel.nassilva@gmail.com';
  
  console.log(`\n🔍 Verificando usuário: ${email}\n`);
  
  try {
    // Verificar se o usuário existe
    const user = await UserModel.findByEmail(email);
    
    if (!user) {
      console.log('❌ Usuário não encontrado no banco de dados');
      console.log('\n💡 Você pode criar o usuário através da rota /api/auth/register');
      return;
    }
    
    console.log('✅ Usuário encontrado:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Nome: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Ativo: ${user.is_active ? 'Sim' : 'Não'}`);
    console.log(`   Criado em: ${user.created_at}`);
    
    if (!user.is_active) {
      console.log('\n⚠️  ATENÇÃO: O usuário está INATIVO!');
      console.log('   Isso impede o login. Você precisa ativar o usuário.');
    }
    
    // Testar senha
    console.log('\n🔐 Testando senha...');
    const testPassword = '46184635Avs1978$';
    const isValid = await UserModel.verifyPassword(user, testPassword);
    
    if (isValid) {
      console.log('✅ Senha está CORRETA');
    } else {
      console.log('❌ Senha está INCORRETA');
      console.log('   Verifique se a senha digitada está correta.');
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar usuário:', error);
  }
  
  process.exit(0);
}

checkUser();

