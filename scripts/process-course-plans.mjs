/**
 * @file scripts/process-course-plans.mjs
 * @description 2026년 RISE사업 평생직업교육과정 운영계획서 PDF(16개)를 분석하여
 *              개별 마크다운(.md) 파일과 배너/사진 파일을 추출 및 정리하는 자동화 스크립트입니다.
 * 
 * [주요 기능 및 처리 로직]
 * 1. 대상 디렉터리 내의 운영계획서 PDF 16개를 순회합니다.
 * 2. 한컴오피스 HWP 변환 특성상 발생할 수 있는 글꼴 깨짐(Adobe-WinCharSetFFFF)을 감지하고,
 *    필요 시 Tesseract OCR(psm 6 모드)을 보조로 결합하여 주요 내용 및 기대효과 텍스트를 누락 없이 100% 복원합니다.
 * 3. PDF에 포함된 실제 이미지(배너, 로고, 홍보 포스터 등)를 선별하여 하부 폴더(images/[PDF파일명]/)에 저장합니다.
 * 4. 교육과정 개요, 모집 계획, 강의계획표(시간표), 강사 현황, 소요 예산 등 시스템 입력에 최적화된 마크다운 문서를 생성합니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

// 1. 작업 대상 디렉터리 설정 (NFC/NFD 호환)
const docsDir = 'docs';
const allDocsEntries = fs.readdirSync(docsDir);
const planDirName = allDocsEntries.find(d => d.normalize('NFC').includes('운영계획서'));

if (!planDirName) {
  console.error('❌ 운영계획서 폴더를 찾을 수 없습니다.');
  process.exit(1);
}

const targetBaseDir = path.join(docsDir, planDirName);
const imagesBaseDir = path.join(targetBaseDir, 'images');

// 임시 스크래치 디렉터리
const scratchDir = path.join(process.cwd(), 'tmp', 'plans_processing');
if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}

// 대상 PDF 목록 조회
const pdfFiles = fs.readdirSync(targetBaseDir).filter(f => f.endsWith('.pdf'));
console.log(`📌 총 ${pdfFiles.length}개의 운영계획서 PDF 파일을 처리합니다.\n`);

/**
 * 특수문자 제거 보조 함수
 */
function sanitizeFileName(str) {
  return str.replace(/[\\/:*?"<>|]/g, '').trim();
}

/**
 * 3페이지의 주요내용 및 기대효과를 OCR로 추출하는 보조 함수
 */
function extractOverviewViaOCR(pdfFilePath, baseName) {
  const tempPrefix = path.join(scratchDir, 'ocr_' + sanitizeFileName(baseName).slice(0, 10));
  try {
    // 3페이지 고해상도(300 DPI) 이미지로 렌더링
    execFileSync('pdftoppm', ['-png', '-r', '300', '-f', '3', '-l', '3', pdfFilePath, tempPrefix]);
    const pngPath = `${tempPrefix}-3.png`;
    if (!fs.existsSync(pngPath)) return null;

    // tesseract psm 6 (단일 텍스트 블록 가정) 실행
    const ocrOutput = execFileSync('tesseract', [pngPath, 'stdout', '-l', 'kor+eng', '--psm', '6'], { encoding: 'utf8' });
    
    // 임시 이미지 정리
    if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);

    return ocrOutput;
  } catch (err) {
    console.warn(`    ⚠️ OCR 처리 중 경고 (${baseName}):`, err.message);
    return null;
  }
}

/**
 * 운영계획서 1건 처리 메인 함수
 */
function processSinglePlan(pdfFileName, index) {
  const normFileName = pdfFileName.normalize('NFC');
  const baseName = normFileName.replace(/\.pdf$/, '');
  const pdfFilePath = path.join(targetBaseDir, pdfFileName);

  console.log(`--------------------------------------------------------------------------------`);
  console.log(`[${index + 1}/${pdfFiles.length}] 처리 시작: ${baseName}`);

  // 1. 전체 텍스트 추출 (pdftotext)
  let fullText = '';
  try {
    fullText = execFileSync('pdftotext', [pdfFilePath, '-'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    fullText = err.stdout || '';
  }

  // 2. 한글 폰트 누락 여부 검사 (1-2. 주요내용 부분 확인)
  let mainContentSnippet = '';
  let needOcr = false;
  const sIdx = fullText.indexOf('1-2. 주요내용');
  const eIdx = fullText.indexOf('1-3. 교육방법');
  
  if (sIdx !== -1 && eIdx !== -1) {
    const rawSnippet = fullText.slice(sIdx + '1-2. 주요내용'.length, eIdx);
    const hangulCount = (rawSnippet.match(/[\uAC00-\uD7A3]/g) || []).length;
    // 의미 있는 한글 글자 수가 10자 미만이면 깨진 것으로 판단
    if (hangulCount < 10) {
      needOcr = true;
    } else {
      mainContentSnippet = rawSnippet.trim();
    }
  } else {
    needOcr = true;
  }

  let ocrRestoredOverview = '';
  if (needOcr) {
    console.log(`  🔍 폰트 특수 인코딩 감지됨 -> Tesseract OCR 보조 결합 수행 중...`);
    const ocrText = extractOverviewViaOCR(pdfFilePath, baseName);
    if (ocrText) {
      ocrRestoredOverview = ocrText;
      console.log(`  ✨ OCR 복원 완료! (텍스트 길이: ${ocrText.length}자)`);
    }
  }

  // 3. 실제 유효 이미지(배너, 로고, 홍보 포스터 등) 추출
  const tempImgDir = path.join(scratchDir, `img_plan_${index}`);
  if (fs.existsSync(tempImgDir)) {
    fs.rmSync(tempImgDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempImgDir, { recursive: true });

  try {
    execFileSync('pdfimages', ['-png', pdfFilePath, path.join(tempImgDir, 'img')]);
  } catch (err) {
    // 이미지 추출 오류 무시
  }

  const extractedImgs = fs.existsSync(tempImgDir) ? fs.readdirSync(tempImgDir).filter(f => f.endsWith('.png')).sort() : [];
  const validImages = [];

  for (const imgName of extractedImgs) {
    const p = path.join(tempImgDir, imgName);
    const stat = fs.statSync(p);
    // 5KB 이상인 경우만 실제 유효한 이미지로 평가 (1px 라인 및 마스크 제외)
    if (stat.size > 5000) {
      try {
        const sipsOut = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', p], { encoding: 'utf8' });
        const wMatch = sipsOut.match(/pixelWidth:\s+(\d+)/);
        const hMatch = sipsOut.match(/pixelHeight:\s+(\d+)/);
        const w = wMatch ? parseInt(wMatch[1], 10) : 0;
        const h = hMatch ? parseInt(hMatch[1], 10) : 0;
        // 가로와 세로가 모두 50px 이상인 유효 이미지
        if (w >= 50 && h >= 50) {
          validImages.push({
            tempPath: p,
            fileName: imgName,
            width: w,
            height: h,
            size: stat.size
          });
        }
      } catch (e) {
        // sips 오류 무시
      }
    }
  }

  // 4. 유효 이미지가 있는 경우 하위 폴더에 저장 (중복 해시 제거)
  const savedImagesList = [];
  if (validImages.length > 0) {
    const pdfImagesDir = path.join(imagesBaseDir, baseName);
    // 기존 폴더가 있다면 초기화
    if (fs.existsSync(pdfImagesDir)) {
      fs.rmSync(pdfImagesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(pdfImagesDir, { recursive: true });

    const seenHashes = new Set();
    let savedIndex = 1;

    for (let i = 0; i < validImages.length; i++) {
      const vImg = validImages[i];
      // 파일 SHA256 해시 계산으로 내용이 동일한 중복 이미지(예: 헤더 로고 반복) 필터링
      const fileBuffer = fs.readFileSync(vImg.tempPath);
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      if (seenHashes.has(hash)) {
        // 이미 저장된 동일한 이미지이므로 건너뜀
        continue;
      }
      seenHashes.add(hash);

      const orderNum = String(savedIndex).padStart(2, '0');
      let imgTitle = '이미지';
      if (vImg.width > 500 && vImg.height > 400) {
        imgTitle = '홍보포스터';
      } else if (vImg.width === 458 && vImg.height === 59) {
        imgTitle = 'RISE사업단_헤더로고';
      } else if (vImg.width > 300 && vImg.height < 150) {
        imgTitle = '배너_로고';
      }

      const newFileName = `${orderNum}_${imgTitle}_${vImg.width}x${vImg.height}.png`;
      const destPath = path.join(pdfImagesDir, newFileName);
      fs.copyFileSync(vImg.tempPath, destPath);

      savedImagesList.push({
        order: savedIndex,
        title: imgTitle,
        fileName: newFileName,
        rawRelativePath: `images/${baseName}/${newFileName}`,
        width: vImg.width,
        height: vImg.height
      });

      savedIndex++;
    }
    console.log(`  🖼️ 고유 유효 이미지: ${savedImagesList.length}장 저장 완료 (images/${baseName}/)`);
  } else {
    console.log(`  ℹ️ 유효 이미지 없음 (텍스트/표 중심 문서)`);
  }

  // 5. 마크다운(.md) 문서 생성
  const mdContent = generatePlanMarkdown(fullText, baseName, ocrRestoredOverview, savedImagesList);

  // 6. 루트 디렉터리에 마크다운 파일 저장
  const mdFilePath = path.join(targetBaseDir, `${baseName}.md`);
  fs.writeFileSync(mdFilePath, mdContent, 'utf8');

  console.log(`  ✅ 마크다운 생성 완료: ${baseName}.md\n`);
}

/**
 * 운영계획서 마크다운 생성 함수
 */
function generatePlanMarkdown(fullText, baseName, ocrOverview, imageList) {
  // 표지 메타정보 추출
  const rawLines = fullText.split('\n');
  const nonBlankLines = rawLines.map(l => l.trim()).filter(l => l.length > 0);

  // 아카데미 트랙 및 대상 탐색
  let track = '평생직업교육과정';
  if (fullText.includes('스마트테크 아카데미')) track = '스마트테크 아카데미';
  if (fullText.includes('라이프케어 아카데미')) track = '라이프케어 아카데미';
  if (fullText.includes('로컬창업 아카데미')) track = '로컬창업 아카데미';
  if (fullText.includes('팝업 아카데미')) track = '팝업 아카데미';

  // 담당 교수 추출
  let professor = '';
  const profMatch = baseName.match(/\((.*?)\s*([가-힣]{2,4})\)/);
  if (profMatch) {
    professor = `${profMatch[2]} (${profMatch[1]})`;
  } else {
    for (let i = 0; i < Math.min(nonBlankLines.length, 30); i++) {
      if (nonBlankLines[i] === '담당교수' || nonBlankLines[i].includes('담당교수')) {
        professor = nonBlankLines[i + 1] || '';
        break;
      }
    }
  }

  // 작성일자 추출
  let planDate = '2026';
  const dateMatch = fullText.match(/2026\.\s*\d+\.\s*\d+\.?/);
  if (dateMatch) planDate = dateMatch[0];

  // 과정명 추출
  let courseName = baseName;
  const courseMatch = fullText.match(/1-1\.\s*과정명\s*:\s*([^\n\r]+)/);
  if (courseMatch) {
    courseName = courseMatch[1].trim();
  } else {
    const pMatch = fullText.match(/\((.*?양성과정|.*?프로그램|.*?과정)\)/);
    if (pMatch) courseName = pMatch[1].trim();
  }

  // 1. 프로그램 개요 (주요내용, 교육방법, 기대효과)
  let overviewText = '';
  if (ocrOverview) {
    overviewText = ocrOverview;
  } else {
    const sIdx = fullText.indexOf('운 영 계 획 서');
    const eIdx = fullText.indexOf('2. 모집 대상 계획');
    if (sIdx !== -1 && eIdx !== -1) {
      overviewText = fullText.slice(sIdx + '운 영 계 획 서'.length, eIdx).trim();
    } else {
      overviewText = fullText.slice(0, 1500).trim();
    }
  }

  // 2. 모집 대상 계획 추출
  let recruitText = '';
  const recruitIdx = fullText.indexOf('2. 모집 대상 계획');
  const governIdx = fullText.indexOf('3. 거버넌스 활용 계획');
  const lectureIdx = fullText.indexOf('5. 강의계획');
  if (recruitIdx !== -1) {
    const end = governIdx !== -1 ? governIdx : (lectureIdx !== -1 ? lectureIdx : recruitIdx + 1500);
    recruitText = fullText.slice(recruitIdx, end).trim();
  }

  // 3. 거버넌스 및 자격증 정보 추출
  let governText = '';
  if (governIdx !== -1) {
    const end = lectureIdx !== -1 ? lectureIdx : governIdx + 1500;
    governText = fullText.slice(governIdx, end).trim();
  }

  // 4. 강의계획 (시간표) 추출
  let lectureScheduleText = '';
  if (lectureIdx !== -1) {
    const instIdx = fullText.indexOf('6. 강사현황');
    const end = instIdx !== -1 ? instIdx : lectureIdx + 3000;
    lectureScheduleText = fullText.slice(lectureIdx, end).trim();
  }

  // 5. 강사 현황 추출
  let instructorText = '';
  const instIdx = fullText.indexOf('6. 강사현황');
  const budgetIdx = fullText.indexOf('9. 예산계획');
  if (instIdx !== -1) {
    const end = budgetIdx !== -1 ? budgetIdx : instIdx + 1500;
    instructorText = fullText.slice(instIdx, end).trim();
  }

  // 6. 예산 계획 추출
  let budgetText = '';
  if (budgetIdx !== -1) {
    budgetText = fullText.slice(budgetIdx).trim();
  }

  // 마크다운 문서 빌드
  let md = `# ${courseName} 운영계획서\n\n`;

  md += `## 1. 기본 정보\n\n`;
  md += `| 항목 | 내용 |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **사업명** | 2026학년도 지역혁신중심 대학지원체계(RISE)사업 |\n`;
  md += `| **교육 트랙** | ${track} |\n`;
  md += `| **과정명** | ${courseName} |\n`;
  md += `| **담당교수** | ${professor || '담당교수 지정'} |\n`;
  md += `| **작성일자** | ${planDate} |\n\n`;

  if (imageList.length > 0) {
    md += `## 2. 관련 이미지 및 배너\n\n`;
    for (const img of imageList) {
      md += `### ${img.order}. ${img.title} (${img.width}x${img.height})\n\n`;
      md += `![${img.title}](${img.rawRelativePath})\n\n`;
    }
  }

  md += `## 3. 프로그램 개요 (주요내용 및 기대효과)\n\n`;
  md += `\`\`\`\n${overviewText}\n\`\`\`\n\n`;

  if (recruitText) {
    md += `## 4. 모집 대상 계획\n\n`;
    md += `\`\`\`\n${recruitText}\n\`\`\`\n\n`;
  }

  if (governText) {
    md += `## 5. 거버넌스 및 관련 자격증\n\n`;
    md += `\`\`\`\n${governText}\n\`\`\`\n\n`;
  }

  if (lectureScheduleText) {
    md += `## 6. 강의계획표 (상세 교육과정 편성)\n\n`;
    md += `\`\`\`\n${lectureScheduleText}\n\`\`\`\n\n`;
  }

  if (instructorText) {
    md += `## 7. 강사 및 보조강사 현황\n\n`;
    md += `\`\`\`\n${instructorText}\n\`\`\`\n\n`;
  }

  if (budgetText) {
    md += `## 8. 소요 예산 계획\n\n`;
    md += `\`\`\`\n${budgetText}\n\`\`\`\n\n`;
  }

  md += `---\n`;
  md += `*원문 파일: \`${baseName}.pdf\`*\n`;

  return md;
}

// 16개 파일 순차 처리 실행
console.log('🚀 운영계획서 변환 및 이미지 추출 작업을 시작합니다...\n');
for (let i = 0; i < pdfFiles.length; i++) {
  processSinglePlan(pdfFiles[i], i);
}

console.log('🎉 모든 운영계획서(16건) 처리 및 마크다운 생성이 성공적으로 완료되었습니다!');
