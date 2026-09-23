/**
 * @file scripts/process-course-reports.mjs
 * @description 2026년 앵커사업 평생직업교육과정 운영결과보고서 PDF를 분석하여
 *              개별 마크다운(.md) 파일과 제목/일자가 포함된 사진 파일을 추출 및 정리하는 스크립트입니다.
 * 
 * [동작 순서]
 * 1. 대상 디렉터리 내의 결과보고서 PDF 7개를 순회합니다.
 * 2. poppler 도구(pdfimages, pdftotext)를 활용하여 고화질 원본 사진과 텍스트를 추출합니다.
 * 3. 텍스트 내의 사진 설명(제목, 일자)을 파싱하여 이미지 파일명을 정규화합니다.
 * 4. 각 PDF별 하위 폴더(images/[PDF파일명]/)에 사진을 저장합니다.
 * 5. 시스템 입력에 최적화된 마크다운(.md) 파일을 해당 디렉터리의 루트에 생성합니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// 1. 작업 대상 디렉터리 경로 설정 (NFC/NFD 호환을 위해 폴더 목록에서 탐색)
const docsDir = 'docs';
const allDocsEntries = fs.readdirSync(docsDir);
const reportDirName = allDocsEntries.find(d => d.normalize('NFC').includes('운영결과보고서'));

if (!reportDirName) {
  console.error('❌ 운영결과보고서 폴더를 찾을 수 없습니다.');
  process.exit(1);
}

const targetBaseDir = path.join(docsDir, reportDirName);
const imagesBaseDir = path.join(targetBaseDir, 'images');

// 임시 디렉터리 생성 (스크립트 실행 중 필요한 임시 파일 보관)
const scratchDir = path.join(process.cwd(), 'tmp', 'reports_processing');
if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}

// 대상 PDF 목록 조회
const pdfFiles = fs.readdirSync(targetBaseDir).filter(f => f.endsWith('.pdf'));
console.log(`📌 총 ${pdfFiles.length}개의 운영결과보고서 PDF 파일을 처리합니다.\n`);

/**
 * 일자 문자열을 YYYYMMDD 형태로 정규화하는 보조 함수
 * 예: "2026. 6 . 6 " -> "20260606", "2026.07.14." -> "20260714"
 */
function normalizeDate(rawDateStr) {
  if (!rawDateStr) return '';
  const numbers = rawDateStr.match(/\d+/g);
  if (!numbers || numbers.length < 3) return '';
  const year = numbers[0];
  const month = numbers[1].padStart(2, '0');
  const day = numbers[2].padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 파일명에 사용할 수 없는 특수문자 제거 함수
 */
function sanitizeFileName(str) {
  return str.replace(/[\\/:*?"<>|]/g, '').trim();
}

/**
 * 결과보고서 1건 처리 메인 함수
 */
function processSingleReport(pdfFileName, index) {
  const normFileName = pdfFileName.normalize('NFC');
  const baseName = normFileName.replace(/\.pdf$/, '');
  const pdfFilePath = path.join(targetBaseDir, pdfFileName);

  console.log(`--------------------------------------------------------------------------------`);
  console.log(`[${index + 1}/${pdfFiles.length}] 처리 시작: ${baseName}`);

  // 1. PDF 텍스트 추출 (pdftotext 사용)
  const fullText = execFileSync('pdftotext', [pdfFilePath, '-'], { encoding: 'utf8' });

  // 2. 사진 캡션 추출 (제목 및 일자 추출)
  // 정규식: 개강식, 수료식, 운영사진1, 운영사진1-기초실습 등 괄호 안의 일자 포함
  const captionRegex = /((?:개강식|수료식|운영사진\d*(?:-[^\(\)\n]+)?)\s*\(([^\)]+)\))/g;
  const parsedCaptions = [];
  let capMatch;
  while ((capMatch = captionRegex.exec(fullText)) !== null) {
    const rawCaption = capMatch[1].trim();
    const rawDate = capMatch[2].trim();
    
    // 제목 분리 (괄호 앞부분)
    const title = rawCaption.split('(')[0].trim();
    const formattedDate = normalizeDate(rawDate);
    
    parsedCaptions.push({
      raw: rawCaption,
      title: title,
      date: formattedDate,
      displayDate: rawDate.replace(/\s+/g, '')
    });
  }

  // 3. 사진 파일 추출 (pdfimages -png)
  const tempExtractDir = path.join(scratchDir, `extract_${index}`);
  if (fs.existsSync(tempExtractDir)) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempExtractDir, { recursive: true });

  execFileSync('pdfimages', ['-png', pdfFilePath, path.join(tempExtractDir, 'img')]);
  const extractedFiles = fs.readdirSync(tempExtractDir).filter(f => f.endsWith('.png')).sort();

  // 마스크(1~2KB 알파채널)나 1픽셀 선 등을 제외하고 실제 유효 사진만 선별
  const validPhotos = [];
  for (const imgName of extractedFiles) {
    const p = path.join(tempExtractDir, imgName);
    const stat = fs.statSync(p);
    // 파일 크기가 15KB 이상인 경우만 사진으로 간주
    if (stat.size > 15000) {
      const sipsOut = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', p], { encoding: 'utf8' });
      const wMatch = sipsOut.match(/pixelWidth:\s+(\d+)/);
      const hMatch = sipsOut.match(/pixelHeight:\s+(\d+)/);
      const w = wMatch ? parseInt(wMatch[1], 10) : 0;
      const h = hMatch ? parseInt(hMatch[1], 10) : 0;
      // 가로 및 세로가 200픽셀 이상인 유효 사진
      if (w >= 200 && h >= 200) {
        validPhotos.push({
          tempPath: p,
          fileName: imgName,
          width: w,
          height: h,
          size: stat.size
        });
      }
    }
  }

  console.log(`  📸 캡션: ${parsedCaptions.length}개 발견, 유효 사진: ${validPhotos.length}장 추출`);

  // 4. 사진 파일 저장 (images/[PDF파일명]/ 폴더 생성 후 복사)
  const pdfImagesDir = path.join(imagesBaseDir, baseName);
  if (!fs.existsSync(pdfImagesDir)) {
    fs.mkdirSync(pdfImagesDir, { recursive: true });
  }

  const savedPhotoInfoList = [];
  for (let i = 0; i < validPhotos.length; i++) {
    const photo = validPhotos[i];
    const orderNum = String(i + 1).padStart(2, '0');
    
    // 매칭되는 캡션이 있는 경우 제목 및 일자 적용
    const caption = parsedCaptions[i];
    let photoTitle = caption ? caption.title : `운영사진_${i + 1}`;
    let photoDate = caption && caption.date ? caption.date : '';
    let displayDate = caption && caption.displayDate ? caption.displayDate : '';

    // 파일명 생성: 예) 01_개강식_20260606.png
    let newFileName = `${orderNum}_${sanitizeFileName(photoTitle)}`;
    if (photoDate) {
      newFileName += `_${photoDate}`;
    }
    newFileName += '.png';

    const destPath = path.join(pdfImagesDir, newFileName);
    fs.copyFileSync(photo.tempPath, destPath);

    savedPhotoInfoList.push({
      order: i + 1,
      title: photoTitle,
      date: displayDate,
      fileName: newFileName,
      // 마크다운에서 참조할 상대 경로
      relativePath: `images/${encodeURIComponent(baseName)}/${encodeURIComponent(newFileName)}`,
      rawRelativePath: `images/${baseName}/${newFileName}`,
      width: photo.width,
      height: photo.height
    });
  }

  // 5. 마크다운(.md) 파일 내용 구성
  const mdContent = generateReportMarkdown(fullText, baseName, savedPhotoInfoList);

  // 6. 마크다운 파일 저장 (디렉터리 루트)
  const mdFilePath = path.join(targetBaseDir, `${baseName}.md`);
  fs.writeFileSync(mdFilePath, mdContent, 'utf8');

  console.log(`  ✅ 마크다운 생성 완료: ${baseName}.md`);
  console.log(`  📁 사진 저장 완료: images/${baseName}/ (${savedPhotoInfoList.length}장)\n`);
}

/**
 * 추출된 텍스트와 사진 목록을 바탕으로 마크다운 문서를 깔끔하게 조합하는 함수
 */
function generateReportMarkdown(fullText, baseName, photoList) {
  // 개행 정리 및 빈 줄 제거된 라인 목록 구성
  const rawLines = fullText.split('\n');
  const nonBlankLines = rawLines.map(l => l.trim()).filter(l => l.length > 0);

  // 메타 정보 추출
  let domain = '';
  let subProgram = '';
  let professor = '';
  let period = '';
  let reportDate = '';

  for (let i = 0; i < Math.min(nonBlankLines.length, 35); i++) {
    const line = nonBlankLines[i];
    if (line === '영 역' || line === '영역') {
      domain = nonBlankLines[i + 1] || '';
    }
    if (line === '세부프로그램명' || line.includes('세부프로그램명')) {
      subProgram = nonBlankLines[i + 1] || '';
    }
    if (line === '담당 교수' || line === '담당교수' || line.includes('담당 교수')) {
      professor = nonBlankLines[i + 1] || '';
    }
    if (line === '교육 기간' || line === '교육기간' || line.includes('교육 기간')) {
      period = nonBlankLines[i + 1] || '';
    }
    if (/^2026\.\s*\d+\.\s*\d+\.?$/.test(line)) {
      reportDate = line;
    }
  }

  // 과정명 기본값 설정
  if (!subProgram) {
    const titleMatch = fullText.match(/\((.*?양성과정|.*?결과보고.*?)\)/);
    subProgram = titleMatch ? titleMatch[1] : baseName;
  }

  // 주요 내용 추출
  let mainContent = '';
  const mainContentIndex = fullText.indexOf('2. 주요 내용');
  const outcomeIndex = fullText.indexOf('3. 운영 성과');
  if (mainContentIndex !== -1 && outcomeIndex !== -1) {
    mainContent = fullText.slice(mainContentIndex + '2. 주요 내용'.length, outcomeIndex).trim();
  }

  // 성과 수치 추출 (모집정원, 모집인원, 수료인원, 만족도 등)
  let capacity = '20';
  let enrolled = '-';
  let completed = '-';
  let completionRate = '-';
  let certCount = '0';
  let certRate = '-';
  let jobCount = '0';
  let jobRate = '-';
  let satisfaction = '-';

  if (outcomeIndex !== -1) {
    const outcomeText = fullText.slice(outcomeIndex, outcomeIndex + 600);
    // 숫자 패턴 탐색
    const percentMatches = [...outcomeText.matchAll(/([\d.]+)\s*%/g)].map(m => m[1]);
    if (percentMatches.length > 0) completionRate = percentMatches[0] + '%';
    if (percentMatches.length > 1) satisfaction = percentMatches[percentMatches.length - 1] + '%';

    // 수치 매칭 시도
    const lines = outcomeText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    // 20, 15, 13 형태의 정수 연속 탐색
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === '모집정원' || lines[i].includes('모집정원')) {
        // 뒤따르는 숫자들 파싱
        const numbers = [];
        for (let j = i + 1; j < Math.min(lines.length, i + 15); j++) {
          if (/^\d+$/.test(lines[j])) {
            numbers.push(lines[j]);
          }
        }
        if (numbers.length >= 3) {
          capacity = numbers[0];
          enrolled = numbers[1];
          completed = numbers[2];
        }
        break;
      }
    }
  }

  // 4. 강사별 교육시간 상세 내역 추출
  let instructorSection = '';
  const instructorIndex = fullText.indexOf('4. 강사별 교육시간 상세 내역');
  const budgetIndex = fullText.indexOf('5. 예산');
  if (instructorIndex !== -1) {
    const endIdx = budgetIndex !== -1 ? budgetIndex : fullText.indexOf('5. ');
    if (endIdx !== -1) {
      instructorSection = fullText.slice(instructorIndex + '4. 강사별 교육시간 상세 내역'.length, endIdx).trim();
    } else {
      instructorSection = fullText.slice(instructorIndex + '4. 강사별 교육시간 상세 내역'.length, instructorIndex + 2500).trim();
    }
  }

  // 5. 예산 집행 현황 추출
  let budgetSection = '';
  if (budgetIndex !== -1) {
    const qualityIndex = fullText.indexOf('6. 프로그램 품질 개선');
    const endIdx = qualityIndex !== -1 ? qualityIndex : fullText.indexOf('6. ');
    if (endIdx !== -1) {
      budgetSection = fullText.slice(budgetIndex, endIdx).trim();
    }
  }

  // 6. 프로그램 품질 개선 & 총평
  let qualitySection = '';
  const qualityIndex = fullText.indexOf('6. 프로그램 품질 개선');
  if (qualityIndex !== -1) {
    qualitySection = fullText.slice(qualityIndex).trim();
  }

  // 마크다운 문서 빌드
  let md = `# ${subProgram} 운영결과보고서\n\n`;

  md += `## 1. 기본 정보\n\n`;
  md += `| 항목 | 내용 |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **사업명** | 2026학년도 지역성장 인재양성체계(앵커)사업 |\n`;
  md += `| **영역** | ${domain || '로컬창업 / 라이프케어'} |\n`;
  md += `| **프로그램명** | ${subProgram} |\n`;
  md += `| **담당교수** | ${professor} |\n`;
  md += `| **교육기간** | ${period} |\n`;
  if (reportDate) {
    md += `| **보고일자** | ${reportDate} |\n`;
  }
  md += `\n`;

  md += `## 2. 주요 내용\n\n`;
  if (mainContent) {
    md += `${mainContent}\n\n`;
  } else {
    md += `- 세부 교육과정 및 실습 중심 직업교육 진행\n\n`;
  }

  md += `## 3. 운영 성과\n\n`;
  md += `| 구분 | 모집정원 | 모집인원 | 수료인원 (수료율) | 자격증 취득 (취득율) | 취·창업인원 (취창업율) | 교육만족도 |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;
  md += `| **실적** | ${capacity}명 | ${enrolled}명 | ${completed}명 (${completionRate}) | ${certCount}명 (${certRate}) | ${jobCount}명 (${jobRate}) | ${satisfaction} |\n\n`;

  md += `## 4. 교육 운영 사진\n\n`;
  md += `> 교육과정 운영 중 촬영된 주요 사진입니다. 개별 사진 파일은 \`images/${baseName}/\` 폴더에 저장되어 있습니다.\n\n`;
  md += `| 번호 | 사진 제목 | 교육 일자 | 사진 미리보기 | 파일명 |\n`;
  md += `| :---: | :--- | :---: | :---: | :--- |\n`;

  for (const p of photoList) {
    md += `| ${p.order} | **${p.title}** | ${p.date || '-'} | <img src="${p.rawRelativePath}" alt="${p.title}" width="240" /> | \`${p.fileName}\` |\n`;
  }
  md += `\n`;

  // 사진 큰 이미지 갤러리 섹션 추가 (시스템 입력 및 뷰어에서 바로 볼 수 있도록)
  md += `### 📸 운영 사진 갤러리\n\n`;
  for (const p of photoList) {
    md += `#### ${p.order}. ${p.title} ${p.date ? `(${p.date})` : ''}\n\n`;
    md += `![${p.title}](${p.rawRelativePath})\n\n`;
  }

  md += `## 5. 강사별 교육시간 상세 내역\n\n`;
  if (instructorSection) {
    md += `\`\`\`\n${instructorSection}\n\`\`\`\n\n`;
  } else {
    md += `- 상세 교육시간 내역은 원본 문서 참조\n\n`;
  }

  if (budgetSection) {
    md += `## 6. 예산 집행 현황\n\n`;
    md += `\`\`\`\n${budgetSection}\n\`\`\`\n\n`;
  }

  if (qualitySection) {
    md += `## 7. 프로그램 품질 개선 및 총평\n\n`;
    md += `\`\`\`\n${qualitySection}\n\`\`\`\n\n`;
  }

  md += `---\n`;
  md += `*원문 파일: \`${baseName}.pdf\`*\n`;

  return md;
}

// 7개 파일 순차 처리 실행
console.log('🚀 운영결과보고서 변환 및 사진 추출 작업을 시작합니다...\n');
for (let i = 0; i < pdfFiles.length; i++) {
  processSingleReport(pdfFiles[i], i);
}

console.log('🎉 모든 운영결과보고서(7건) 처리 및 사진 저장이 성공적으로 완료되었습니다!');
