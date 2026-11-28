# Hướng dẫn tạo Cinema Video Loops cho Phòng Thi 3D Pro (0đ/tháng)

Engine `js/speaking_examiner_cinema.js` đã dựng sẵn chế độ **Dual-Video Seamless Crossfade** (kiểu Praktika / Duolingo Video Call).

## 1. Tên file cần bỏ vào thư mục `assets/videos/`
Mỗi giám khảo gồm 4 clip MP4 ngắn (`4–5 giây`, tỷ lệ `16:9`, `1280×720`, không tiếng — tắt audio track, nhẹ ~1.5–2.5 MB/clip):

### Ms. Claire (Nữ · UK)
* `examiner_claire_idle.mp4` — Ngồi mỉm cười nhẹ, thở tự nhiên, chớp mắt thật, giao tiếp mắt.
* `examiner_claire_speak.mp4` — Cử động miệng nói chuyện tự nhiên, nhướng mày nhẹ, gật đầu nhẹ theo nhịp nói.
* `examiner_claire_nod.mp4` — Lắng nghe chăm chú, mỉm cười nhẹ và gật đầu khích lệ 2 nhịp.
* `examiner_claire_notes.mp4` — Nhìn xuống ghi chép nhanh bằng bút lên kẹp bìa trên bàn rồi ngước lên nhìn lại.

### Mr. Oliver (Nam · UK)
* `examiner_oliver_idle.mp4`
* `examiner_oliver_speak.mp4`
* `examiner_oliver_nod.mp4`
* `examiner_oliver_notes.mp4`

## 2. Prompt chuẩn cho Veo 3 / Kling 2.1 / Runway Gen-4 (Image-to-Video)
Dùng ảnh gốc `assets/images/examiner_claire_speak.webp` (hoặc `examiner_oliver_speak.webp`) làm **Start Frame & End Frame** (giúp vòng lặp mượt không giật):

* **Idle (`_idle.mp4`):**
  > Fixed locked-off tripod camera, eye-level POV across an oak exam desk. The friendly British IELTS examiner sits calmly looking into the camera with natural micro-breathing, gentle eye blinks, and a warm subtle smile. Zero camera movement, seamless loop.
* **Speaking (`_speak.mp4`):**
  > Fixed locked-off tripod camera. The British IELTS examiner speaks warmly and articulately directly to the camera with natural mouth and jaw movements, subtle eyebrow expression, and gentle conversational head motion. Zero camera movement, consistent sunlit office lighting.
* **Nodding (`_nod.mp4`):**
  > Fixed locked-off tripod camera. The British IELTS examiner listens attentively to the candidate with warm eye contact, blinking naturally and giving two gentle, encouraging nods. Zero camera movement, seamless loop.
* **Note-taking (`_notes.mp4`):**
  > Fixed locked-off tripod camera. The British IELTS examiner glances calmly down at the clipboard on the oak desk, writes brief notes with a pen, then looks smoothly back up at the camera with an attentive expression. Zero camera movement.

## 3. Kích hoạt
Sau khi bỏ đủ 4 file `.mp4` vào `assets/videos/`, mở `js/speaking_examiner_cinema.js` và đổi:
```js
const CINEMA_VIDEO_ENABLED = { claire: true, oliver: true };
```
