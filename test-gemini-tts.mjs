import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY가 .env 파일에 설정되지 않았습니다.');
  console.error('💡 .env 파일을 확인해주세요.');
  process.exit(1);
}

console.log('✅ GEMINI_API_KEY 로드됨:', GEMINI_API_KEY.substring(0, 20) + '...');

async function listModels() {
  try {
    console.log('\n📋 사용 가능한 Gemini 모델 목록 조회 중...\n');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ 전체 모델 수:', data.models?.length || 0, '\n');
    
    // Filter for audio/TTS models
    console.log('🎵 TTS/Audio 관련 모델:\n');
    const audioModels = data.models.filter(m => 
      m.name.toLowerCase().includes('tts') || 
      m.name.toLowerCase().includes('audio')
    );
    
    if (audioModels.length > 0) {
      audioModels.forEach(m => {
        console.log(`📍 ${m.name}`);
        console.log(`   지원 메서드: ${m.supportedGenerationMethods?.join(', ')}`);
        console.log(`   설명: ${m.description || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  TTS/Audio 모델을 찾을 수 없습니다.\n');
    }
    
    // Show gemini-2 models
    console.log('📦 Gemini 2.x 모델:\n');
    const gemini2Models = data.models.filter(m => m.name.includes('gemini-2'));
    gemini2Models.slice(0, 10).forEach(m => {
      console.log(`📍 ${m.name}`);
      console.log(`   메서드: ${m.supportedGenerationMethods?.join(', ')}`);
    });
    
    // Test a simple text generation
    console.log('\n\n🧪 Gemini 2.0 Flash 테스트...\n');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    const result = await model.generateContent('Say hello in Korean');
    const text = result.response.text();
    console.log('✅ 텍스트 응답:', text);
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    if (error.stack) {
      console.error('\n스택:', error.stack);
    }
  }
}

listModels();
