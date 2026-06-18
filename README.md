# Global Language Coach App

아이폰 홈 화면에 추가해서 사용할 수 있는 설치형 웹앱입니다.

## 배포

맥이 꺼져도 아이폰에서 쓰려면 무료 정적 호스팅에 올립니다.

추천 방식은 GitHub Pages입니다. 자세한 절차는 [DEPLOY.md](DEPLOY.md)를 참고합니다.
현재 public 앱 저장소는 GitHub Actions로 Pages에 배포합니다.

## 실행

이 폴더에서 아래 명령을 실행합니다.

```bash
python3 -m http.server 4176
```

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:4176/index.html
```

## 데이터 갱신

`01_Daily Sentences` 또는 `02_World Issues`에 새 마크다운 파일을 추가한 뒤 아래 명령을 실행하면 앱 데이터가 다시 만들어집니다.

```bash
python3 scripts/build_data.py
python3 scripts/bump_version.py
```

## 아이폰 설치

배포 주소를 Safari에서 연 뒤 공유 버튼에서 `홈 화면에 추가`를 선택합니다.
