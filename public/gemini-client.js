// Gemini API 클라이언트 측 호출 유틸리티

// 환경 변수에서 API 키 가져오기 (서버에서 전달받거나 직접 설정)
let GEMINI_API_KEY = null;

// API 키 초기화 함수
async function initGeminiAPIKey() {
    try {
        // 1순위: localStorage에 저장된 커스텀 API 키 확인
        const customApiKey = localStorage.getItem('gemini_api_key');
        if (customApiKey && customApiKey.trim()) {
            GEMINI_API_KEY = customApiKey.trim();
            console.log('✅ 커스텀 Gemini API 키 로드 성공 (localStorage)');
            return true;
        }
        
        // 2순위: 서버로부터 기본 API 키 가져오기
        const response = await axios.get('/api/config');
        if (response.data.success && response.data.apiKey) {
            GEMINI_API_KEY = response.data.apiKey;
            console.log('✅ Gemini API 키 로드 성공 (서버 기본값)');
            return true;
        }
    } catch (error) {
        console.error('❌ API 키 로드 실패:', error);
    }
    return false;
}

/**
 * Gemini API로 이미지 생성 (클라이언트 직접 호출)
 * @param {string} prompt - 이미지 생성 프롬프트
 * @param {Array<string>} referenceImages - 레퍼런스 이미지 URL 배열 (선택)
 * @param {number} maxRetries - 최대 재시도 횟수
 * @param {string} modelOverride - 모델 오버라이드 (선택, 기본값은 imageSettings.imageModel)
 * @returns {Promise<{success: boolean, imageUrl?: string, error?: string}>}
 */
async function generateImageClient(prompt, referenceImages = [], maxRetries = 3, modelOverride = null) {
    if (!GEMINI_API_KEY) {
        const initialized = await initGeminiAPIKey();
        if (!initialized) {
            return {
                success: false,
                error: 'API 키를 로드할 수 없습니다. 서버 설정을 확인해주세요.'
            };
        }
    }

    // 모델 선택: 오버라이드 > imageSettings > 기본값
    const selectedModel = modelOverride || 
                         (typeof imageSettings !== 'undefined' ? imageSettings.imageModel : null) || 
                         'gemini-2.0-flash-exp';

    // 재시도 로직
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // 사용 중인 API 키 정보 표시 (매 시도마다)
            const isCustomKey = !!localStorage.getItem('gemini_api_key');
            const keyPrefix = GEMINI_API_KEY.substring(0, 10);
            console.log(`\n🔑 사용 중인 API 키: ${keyPrefix}... (${isCustomKey ? '✅ 커스텀 키' : '⚠️ 기본 키'})`);
            console.log(`🤖 이미지 AI 모델: ${selectedModel}`);
            console.log(`🎨 이미지 생성 시도 ${attempt + 1}/${maxRetries}`);
            console.log('📝 프롬프트 길이:', prompt.length);
            console.log('🖼️ 레퍼런스 이미지:', referenceImages.length);

            // parts 배열 구성
            const parts = [{ text: prompt }];

            // 레퍼런스 이미지 추가 (URL → Base64 변환)
            if (referenceImages && referenceImages.length > 0) {
                for (const imageUrl of referenceImages) {
                    try {
                        // URL을 Base64로 변환
                        const base64Image = await urlToBase64(imageUrl);
                        parts.push({
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: base64Image
                            }
                        });
                    } catch (error) {
                        console.warn('⚠️ 레퍼런스 이미지 로드 실패:', imageUrl, error);
                    }
                }
            }

            // Gemini API 호출 - 선택한 모델 사용
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`;
            
            const requestBody = {
                contents: [{ parts }],
                generationConfig: {
                    temperature: 1,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192
                }
            };

            console.log('📤 Gemini API 요청 전송...');
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                const isCustomKey = !!localStorage.getItem('gemini_api_key');
                const keyPrefix = GEMINI_API_KEY.substring(0, 10);
                const keyType = isCustomKey ? '✅ 커스텀 키' : '⚠️ 기본 키 (할당량 제한됨)';
                const keyInfo = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔑 현재 사용 중인 API 키\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nAPI 키: ${keyPrefix}...\n타입: ${keyType}\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                
                console.error(`\n❌ API 오류 ${response.status}:`, errorText);
                console.error(`🔑 사용 중인 키: ${keyPrefix}... (${keyType})`);
                
                // 429 할당량 오류 처리
                if (response.status === 429) {
                    const errorMsg = '⚠️ Gemini API 일일 할당량을 초과했습니다.\n\n' +
                        '해결 방법:\n' +
                        '1. 설정에서 개인 API 키를 입력하세요 (추천) ⭐\n' +
                        '2. Google AI Studio (https://aistudio.google.com/app/apikey)에서 무료 API 키 발급\n' +
                        '3. 몇 시간 후 다시 시도 (UTC 자정에 리셋)\n' +
                        '4. 이미 생성된 동화책을 복사하여 텍스트만 수정' +
                        keyInfo;
                    
                    throw new Error(errorMsg);
                }
                
                // 400 에러 (잘못된 API 키)
                if (response.status === 400 || response.status === 403) {
                    const errorMsg = `❌ API 키 오류가 발생했습니다.\n\n` +
                        `HTTP ${response.status}: ${errorText.substring(0, 200)}\n\n` +
                        `해결 방법:\n` +
                        `1. 설정에서 API 키를 확인하세요\n` +
                        `2. Google AI Studio에서 새 API 키를 발급받으세요\n` +
                        `3. API 키가 올바르게 입력되었는지 확인하세요` +
                        keyInfo;
                    
                    throw new Error(errorMsg);
                }
                
                // 500 에러는 재시도
                if (response.status === 500 && attempt < maxRetries - 1) {
                    const waitTime = Math.pow(2, attempt) * 1000; // 지수 백오프
                    console.log(`⏳ ${waitTime/1000}초 후 재시도...`);
                    console.log(`🔑 ${keyPrefix}... (${keyType})`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue; // 다음 시도
                }
                
                throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}${keyInfo}`);
            }

            const data = await response.json();
            console.log('📥 Gemini API 응답 수신');

            // 응답에서 이미지 URL 추출
            if (data.candidates && 
                data.candidates[0] && 
                data.candidates[0].content && 
                data.candidates[0].content.parts) {
                
                for (const part of data.candidates[0].content.parts) {
                    // inlineData (카멜케이스) 체크
                    if (part.inlineData && part.inlineData.data) {
                        // Base64 → Blob URL 변환
                        const imageUrl = base64ToObjectURL(part.inlineData.data, part.inlineData.mimeType);
                        console.log('✅ 이미지 생성 성공!');
                        
                        return {
                            success: true,
                            imageUrl: imageUrl,
                            prompt: prompt
                        };
                    }
                    // inline_data (스네이크케이스) 체크 (하위 호환성)
                    if (part.inline_data && part.inline_data.data) {
                        const imageUrl = base64ToObjectURL(part.inline_data.data, part.inline_data.mime_type);
                        console.log('✅ 이미지 생성 성공!');
                        
                        return {
                            success: true,
                            imageUrl: imageUrl,
                            prompt: prompt
                        };
                    }
                }
            }

            throw new Error('응답에서 이미지 데이터를 찾을 수 없습니다.');

        } catch (error) {
            const isCustomKey = !!localStorage.getItem('gemini_api_key');
            const keyPrefix = GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 10) : 'N/A';
            
            console.error(`❌ 이미지 생성 실패 (시도 ${attempt + 1}/${maxRetries}):`, error);
            console.error(`🔑 사용 중인 키: ${keyPrefix}... (${isCustomKey ? '커스텀' : '기본'})`);
            
            // 마지막 시도가 아니면 재시도
            if (attempt < maxRetries - 1) {
                const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
                console.log(`⏳ ${waitTime/1000}초 후 재시도...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                // 모든 재시도 실패
                const keyInfo = `\n\n🔑 사용된 API 키: ${keyPrefix}... (${isCustomKey ? '커스텀 키' : '기본 키'})`;
                return {
                    success: false,
                    error: `이미지 생성 실패 (${maxRetries}회 시도): ${error.message}${keyInfo}`
                };
            }
        }
    }

    return {
        success: false,
        error: '알 수 없는 오류로 이미지 생성에 실패했습니다.'
    };
}

/**
 * 이미지 URL을 Base64로 변환
 * @param {string} url - 이미지 URL
 * @returns {Promise<string>} - Base64 문자열 (data: 프리픽스 제외)
 */
async function urlToBase64(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const dataURL = canvas.toDataURL('image/jpeg', 0.9);
            // "data:image/jpeg;base64," 제거
            const base64 = dataURL.split(',')[1];
            resolve(base64);
        };
        
        img.onerror = (error) => {
            reject(new Error(`이미지 로드 실패: ${url}`));
        };
        
        img.src = url;
    });
}

/**
 * Base64 문자열을 Blob URL로 변환
 * @param {string} base64 - Base64 문자열
 * @param {string} mimeType - MIME 타입 (예: 'image/jpeg')
 * @returns {string} - Blob URL
 */
function base64ToObjectURL(base64, mimeType = 'image/jpeg') {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    
    return URL.createObjectURL(blob);
}

/**
 * Blob URL을 다운로드 가능한 형태로 변환
 * @param {string} blobUrl - Blob URL
 * @param {string} filename - 저장할 파일 이름
 */
function downloadBlobURL(blobUrl, filename) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// 페이지 로드 시 API 키 초기화
document.addEventListener('DOMContentLoaded', () => {
    initGeminiAPIKey();
});
