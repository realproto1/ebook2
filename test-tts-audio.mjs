import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function testTTS() {
  try {
    console.log('🎵 Gemini 2.5 Flash TTS 테스트 시작...\n');
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-preview-tts'
    });
    
    const text = '안녕하세요. 이것은 한국어 음성 테스트입니다.';
    
    console.log('📝 입력 텍스트:', text);
    console.log('\n🔄 TTS 생성 중...\n');
    
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text }]
      }],
      generationConfig: {
        responseModalities: ['audio'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Puck'
            }
          }
        }
      }
    });
    
    console.log('✅ 응답 받음!');
    console.log('📦 응답 구조:');
    console.log(JSON.stringify(result.response, null, 2));
    
    // Check for audio data
    const candidates = result.response.candidates;
    if (candidates && candidates[0]) {
      const parts = candidates[0].content.parts;
      console.log('\n📍 Parts 개수:', parts.length);
      
      parts.forEach((part, idx) => {
        console.log(`\nPart ${idx}:`);
        if (part.inlineData) {
          console.log('  ✅ inlineData 발견!');
          console.log('  - MIME 타입:', part.inlineData.mimeType);
          console.log('  - 데이터 크기:', part.inlineData.data?.length || 0, '바이트');
          
          // Save to file
          if (part.inlineData.data) {
            const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
            const filename = `test-audio-${Date.now()}.wav`;
            fs.writeFileSync(filename, audioBuffer);
            console.log('  - 파일 저장:', filename);
          }
        } else if (part.text) {
          console.log('  📝 텍스트:', part.text);
        } else {
          console.log('  ❓ 알 수 없는 형식:', Object.keys(part));
        }
      });
    }
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    if (error.stack) {
      console.error('\n스택:', error.stack);
    }
  }
}

testTTS();
