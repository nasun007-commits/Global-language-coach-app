# 배포 가이드

이 앱은 정적 웹앱이라 GitHub Pages, Netlify, Vercel에 무료로 올릴 수 있습니다.

## 선택한 방식: Private GitHub 저장소 + 공개 앱 주소

이 방식은 저장소 파일 목록은 비공개로 두고, 배포된 앱 주소만 공개로 쓰는 방식입니다.

중요한 점:

- 앱 주소를 아는 사람은 앱을 열 수 있습니다.
- `https://배포주소/data/lessons.json`도 열 수 있습니다.
- 즉, 저장소는 비공개지만 앱 데이터는 배포 주소를 통해 접근될 수 있습니다.
- GitHub Pages를 private 저장소에서 쓰려면 GitHub 계정 플랜에서 private repository Pages를 지원해야 합니다.

## GitHub Pages

1. GitHub에서 새 저장소를 만듭니다.
2. 저장소를 `Private`로 설정합니다.
3. 이 `App` 폴더 안의 파일 전체를 저장소 루트에 올립니다.
4. 저장소 `Settings` -> `Pages`로 이동합니다.
5. `Build and deployment`의 `Source`를 `GitHub Actions`로 선택합니다.
6. `main` 브랜치에 파일을 올리면 `.github/workflows/pages.yml`이 자동 배포합니다.
7. 배포가 끝나면 `https://계정명.github.io/저장소명/` 주소로 앱을 열 수 있습니다.

만약 private 저장소에서 GitHub Pages가 활성화되지 않는다면, 현재 계정 플랜에서 지원되지 않는 것입니다. 그 경우에는 저장소는 GitHub private으로 유지하고, 배포는 Netlify 또는 Vercel에 연결하는 방식을 사용합니다.

## 아이폰 설치

1. 아이폰 Safari에서 배포 주소를 엽니다.
2. 공유 버튼을 누릅니다.
3. `홈 화면에 추가`를 선택합니다.

## 데이터 업데이트

새 마크다운 자료를 추가한 뒤 앱 폴더에서 실행합니다.

```bash
python3 scripts/build_data.py
python3 scripts/bump_version.py
```

그 다음 변경된 파일을 GitHub에 올리면 배포 주소의 앱도 업데이트됩니다.

## 업데이트가 늦게 보일 때

이 앱은 오프라인 사용을 위해 캐시를 씁니다. 업데이트 후 바로 안 바뀌면:

- `scripts/bump_version.py`를 실행했는지 확인합니다.
- 아이폰 앱을 완전히 닫았다가 다시 엽니다.
- 그래도 안 되면 Safari에서 배포 주소를 한 번 직접 열어 새로고침합니다.
