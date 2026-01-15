import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API 키
const GEMINI_API_KEY = 'AIzaSyCBbhANVn2ESO3IzRSD-220UzAEEBIQZPk';

// Gemini 이미지 생성 함수 (Nano Banana Pro) - 멀티모달 지원
async function generateImage(prompt, referenceImages = []) {
  try {
    console.log('Calling Gemini Image Generation API (Nano Banana Pro)...');
    console.log('Prompt:', prompt);
    console.log('Reference Images:', referenceImages.length);
    
    // parts 배열 구성 (프롬프트 + 레퍼런스 이미지들)
    const parts = [{ text: prompt }];
    
    // 레퍼런스 이미지 추가 (base64 데이터)
    for (const imageUrl of referenceImages) {
      if (imageUrl && imageUrl.startsWith('data:image/')) {
        const base64Data = imageUrl.split(',')[1];
        const mimeType = imageUrl.split(';')[0].split(':')[1];
        
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }
    }
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: parts
        }],
        generationConfig: {
          temperature: 1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
          responseMimeType: 'text/plain'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Gemini API response received');
    
    // 응답에서 이미지 데이터 추출
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const parts = data.candidates[0].content.parts;
      
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          const base64Image = part.inlineData.data;
          console.log('Image generated successfully');
          return `data:${mimeType};base64,${base64Image}`;
        }
      }
    }
    
    throw new Error('No image data in response');
    
  } catch (error) {
    console.error('Image generation error:', error);
    throw error;
  }
}

// 1. 동화책 스토리 생성 API
app.post('/api/generate-storybook', async (req, res) => {
  try {
    const { title, targetAge, artStyle } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: '동화책 제목을 입력해주세요.' });
    }

    // 연령대별 설정
    const ageSettings = {
      '4-5': { wordCount: '400-500', sentenceLength: '5-8', vocabulary: '쉬운' },
      '5-7': { wordCount: '500-800', sentenceLength: '8-12', vocabulary: '보통' },
      '7-8': { wordCount: '800-1000', sentenceLength: '10-15', vocabulary: '다소 어려운' }
    };
    const settings = ageSettings[targetAge] || ageSettings['5-7'];

    // Gemini로 스토리 생성
    const prompt = `당신은 유아 교육 전문 동화 작가입니다. 다음 조건으로 동화책을 제작해주세요.

제목: "${title}"
타겟 연령: ${targetAge}세
단어 수: ${settings.wordCount}자
문장 길이: ${settings.sentenceLength}어절
어휘 수준: ${settings.vocabulary}

다음 형식의 JSON으로 응답해주세요:

{
  "title": "동화책 제목",
  "characters": [
    {
      "name": "캐릭터 이름",
      "description": "외모와 성격 상세 설명 (영어로, 이미지 생성용)",
      "role": "주인공/조력자/악역 등"
    }
  ],
  "pages": [
    {
      "pageNumber": 1,
      "text": "페이지 텍스트 (한국어, 2-4문장)",
      "scene_description": "위 text 필드의 한국어 내용을 정확히 영어로 번역하여 시각적으로 설명",
      "scene_structure": {
        "characters": "이 장면에 등장하는 캐릭터들과 그들의 행동/표정 (한국어)",
        "background": "배경 설명 (장소, 시간대 등, 한국어)",
        "atmosphere": "분위기와 감정 (한국어)"
      }
    }
  ],
  "theme": "교훈 및 주제",
  "educational_content": {
    "symbols": ["상징 해석 질문 3-4개"],
    "activity": "창의 활동 아이디어",
    "vocabulary": ["영어 단어 6-8개"]
  }
}

요구사항:
- 10-12페이지 분량
- 종결어미: ~했어, ~였어, ~구나 사용
- 밝고 긍정적인 이야기
- 캐릭터 description은 반드시 영어로
- **매우 중요**: 각 페이지에 scene_structure 객체를 반드시 포함하세요
- **매우 중요**: scene_description은 반드시 해당 페이지의 text(한국어) 내용을 정확히 영어로 번역한 것이어야 합니다

예시:
- text: "토끼가 숲에서 당근을 발견했어요" 
- scene_description: "A white rabbit discovered a carrot in the forest"
- scene_structure: {"characters": "흰 토끼가 기쁜 표정으로 당근을 발견함", "background": "초록색 숲속, 햇살이 비치는 낮", "atmosphere": "밝고 즐거운 분위기"}

JSON만 응답하세요.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini Error:', errorText);
      return res.status(500).json({ error: 'AI 스토리 생성 실패' });
    }

    const data = await response.json();
    let storyText = data.candidates[0].content.parts[0].text;
    
    // JSON 추출
    storyText = storyText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const storybook = JSON.parse(storyText);
    
    // ID와 메타데이터 추가
    storybook.id = Date.now().toString();
    storybook.targetAge = targetAge;
    storybook.artStyle = artStyle;
    storybook.createdAt = new Date().toISOString();
    
    res.json({
      success: true,
      storybook
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: '스토리 생성 실패: ' + error.message });
  }
});

// 2. 캐릭터 레퍼런스 이미지 생성
app.post('/api/generate-character-image', async (req, res) => {
  try {
    const { character, artStyle, settings = {} } = req.body;
    
    // 설정값 기본값
    const aspectRatio = settings.aspectRatio || '16:9';
    const enforceNoText = settings.enforceNoText !== false;
    const additionalPrompt = settings.additionalPrompt || '';
    
    // 텍스트 제거 강조
    const noTextPrompt = enforceNoText ? 
      '\n\n**CRITICAL - NO TEXT:** Do NOT include ANY text, labels, words, letters, captions, titles, or character names in the image. Absolutely NO TEXT of any kind. Pure illustration only.' : 
      '\n\n**IMPORTANT:** Do NOT include any text, labels, words, or letters in the image. No text overlays, no character names, no captions. Pure illustration only.';
    
    const prompt = `Create a professional character design reference sheet for a children's storybook character. 

**Character Description:** ${character.description}

**Art Style:** ${artStyle} style for children's book illustration.

**Image Aspect Ratio:** ${aspectRatio}

**Layout:** Generate a single image showing the character in multiple views and expressions:
- Front view (center, main pose)
- Side view (left side)  
- 3/4 view (right side)
- Three facial expressions at the bottom: happy, surprised, and neutral

**Background:** Clean white background suitable for character reference.

**Quality:** High detail, vibrant colors, soft shading, professional children's book illustration quality. The character should have a warm, friendly, and appealing appearance suitable for young children aged 4-8 years.

**Composition:** Arrange all views in a single cohesive character sheet layout that clearly shows the character's design from different angles.
${noTextPrompt}
${additionalPrompt ? '\n\n**Additional Requirements:** ' + additionalPrompt : ''}`;
    
    console.log('Generating character image with settings:', { aspectRatio, enforceNoText });

    const imageUrl = await generateImage(prompt);
    
    res.json({
      success: true,
      imageUrl,
      prompt
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: '이미지 생성 실패: ' + error.message
    });
  }
});

// 3. 페이지 삽화 생성 (캐릭터 레퍼런스 이미지 참조)
app.post('/api/generate-illustration', async (req, res) => {
  try {
    const { page, artStyle, characterReferences, settings = {} } = req.body;
    
    // 설정값 기본값
    const aspectRatio = settings.aspectRatio || '16:9';
    const enforceNoText = settings.enforceNoText !== false;
    const enforceCharacterConsistency = settings.enforceCharacterConsistency !== false;
    const additionalPrompt = settings.additionalPrompt || '';
    
    // 캐릭터 레퍼런스 이미지 수집
    const referenceImages = [];
    let characterInfo = '';
    
    if (characterReferences && characterReferences.length > 0) {
      const consistencyLevel = enforceCharacterConsistency ? 
        '\n\n**Character Consistency - ABSOLUTE REQUIREMENT:** The characters in this scene MUST match EXACTLY the appearance shown in the reference images I provided above with PIXEL-PERFECT accuracy.\n\n' :
        '\n\n**Character Consistency:** The characters in this scene should match the appearance shown in the reference images I provided above.\n\n';
      
      characterInfo = consistencyLevel;
      
      characterReferences.forEach((char, index) => {
        if (char.referenceImage) {
          referenceImages.push(char.referenceImage);
          if (enforceCharacterConsistency) {
            characterInfo += `**Reference Image ${index + 1}:** This is ${char.name}. Copy this character's EXACT appearance with PIXEL-PERFECT accuracy (colors, fur/clothing patterns, facial features, body proportions, eye shape and color, accessories, every single detail) from the reference image.\n`;
          } else {
            characterInfo += `**Reference Image ${index + 1}:** This is ${char.name} - ${char.description}\n`;
          }
        }
      });
      
      if (enforceCharacterConsistency) {
        characterInfo += '\n**ABSOLUTE REQUIREMENT:** Look at the reference images above and recreate each character with PIXEL-PERFECT accuracy. Same colors, same features, same proportions, same EVERYTHING. Do NOT deviate from the reference images by even 1%.';
      }
    }
    
    // 구조화된 장면 설명 구성
    let sceneDetails = '';
    if (page.scene_structure) {
      sceneDetails = `\n\n**Scene Structure:**
- **Characters & Actions:** ${page.scene_structure.characters}
- **Background Setting:** ${page.scene_structure.background}  
- **Mood & Atmosphere:** ${page.scene_structure.atmosphere}`;
    }
    
    // 텍스트 제거 강조
    const noTextPrompt = enforceNoText ? 
      '\n\n**CRITICAL - NO TEXT:** Do NOT include ANY text, labels, words, letters, captions, titles, speech bubbles, or text overlays in the image. Absolutely NO TEXT of any kind. Pure illustration only.' : 
      '\n\n**IMPORTANT:** Do NOT include any text, labels, words, letters, or captions in the image. No speech bubbles, no titles, no text overlays. Pure illustration only.';
    
    const prompt = `Create a beautiful, professional illustration for a children's storybook page.

**Main Scene Description:** ${page.scene_description}
${sceneDetails}
${characterInfo}

**Art Style:** ${artStyle} style for children's book illustration.

**Image Aspect Ratio:** ${aspectRatio}

**Composition:** Create a warm, inviting scene that captures the emotion and action of the story moment. Use a horizontal composition suitable for a storybook spread.

**Lighting & Atmosphere:** Soft, warm lighting with gentle shadows. The scene should feel magical yet safe and welcoming for young children.

**Quality:** High detail, rich colors, professional children's book illustration quality. The image should be engaging and age-appropriate for children aged 4-8 years.

**Background:** Detailed but not overwhelming - the focus should remain on the characters and their actions while providing a rich, immersive environment.
${noTextPrompt}
${additionalPrompt ? '\n\n**Additional Requirements:** ' + additionalPrompt : ''}

Make the illustration emotionally engaging and visually captivating while maintaining a child-friendly, whimsical tone.`;
    
    console.log('Generating illustration with', referenceImages.length, 'reference images');
    console.log('Settings:', { aspectRatio, enforceNoText, enforceCharacterConsistency });

    const imageUrl = await generateImage(prompt, referenceImages);
    
    res.json({
      success: true,
      imageUrl,
      prompt
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: '이미지 생성 실패: ' + error.message
    });
  }
});

// 4. 단어 학습용 이미지 생성
app.post('/api/generate-vocabulary-images', async (req, res) => {
  try {
    const { vocabulary, artStyle, settings = {} } = req.body;
    
    if (!vocabulary || vocabulary.length === 0) {
      return res.status(400).json({ error: '단어 목록이 필요합니다.' });
    }
    
    const aspectRatio = settings.aspectRatio || '1:1';
    const enforceNoText = settings.enforceNoText !== false;
    const additionalPrompt = settings.additionalPrompt || '';
    
    const images = [];
    
    for (const word of vocabulary) {
      try {
        const noTextPrompt = enforceNoText ? 
          '\n\n**CRITICAL - NO TEXT:** Do NOT include ANY text, labels, words, letters, or captions in the image. Absolutely NO TEXT of any kind. Pure illustration only.' :
          '\n\n**IMPORTANT:** Do NOT include any text, labels, words, or letters in the image.';
        
        const prompt = `Create a simple, clear, educational illustration for a children's vocabulary learning card.

**Word to Illustrate:** ${word}

**Art Style:** ${artStyle} style for children's book illustration.

**Image Aspect Ratio:** ${aspectRatio}

**Requirements:**
- Show a clear, simple representation of "${word}"
- Clean white background
- Bright, vibrant colors
- Child-friendly, appealing design
- Age-appropriate for 4-8 years old
- Focus on clarity and easy recognition
${noTextPrompt}
${additionalPrompt ? '\n\n**Additional Requirements:** ' + additionalPrompt : ''}

Create a single, clear image that children can easily understand and associate with the word.`;

        console.log(`Generating vocabulary image for: ${word}`);
        const imageUrl = await generateImage(prompt);
        
        images.push({
          word: word,
          imageUrl: imageUrl,
          success: true
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error generating image for ${word}:`, error);
        images.push({
          word: word,
          imageUrl: null,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      images: images,
      total: vocabulary.length,
      successful: images.filter(img => img.success).length
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: '단어 이미지 생성 실패: ' + error.message
    });
  }
});

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
