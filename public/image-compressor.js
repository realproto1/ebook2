// 이미지 압축 유틸리티
function compressBase64Image(base64Str, maxWidth = 1024, quality = 0.8) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // 최대 너비 제한
            if (width > maxWidth) {
                height = height * (maxWidth / width);
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // JPEG로 압축 (quality: 0.0 ~ 1.0)
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedBase64);
        };
        img.src = base64Str;
    });
}

// 사용 예시:
// const compressed = await compressBase64Image(originalBase64, 1024, 0.8);
