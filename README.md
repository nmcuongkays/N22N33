# Nihongo Memory Coach

Static HTML app for personal JLPT N3/N2 study: vocabulary, kanji, flashcard, SRS review, quiz, Drive Mode.

## Cách chạy trên máy

Do `fetch('./data/study-data.json')`, nên nên chạy qua local server:

```bash
python -m http.server 8000
```

Mở: `http://localhost:8000`

## Cách up lên GitHub Pages

1. Tạo repository mới, ví dụ `nihongo-memory-coach`.
2. Upload toàn bộ file/folder này: `index.html`, `styles.css`, `app.js`, folder `data/`, `.nojekyll`.
3. Vào **Settings → Pages**.
4. Source: **Deploy from a branch**.
5. Branch: `main`, folder: `/root`.
6. Mở link GitHub Pages được tạo.

## Lưu ý bản quyền

Dữ liệu được trích từ các PDF do người dùng cung cấp để học cá nhân. Nếu tài liệu gốc có bản quyền, nên để repository ở chế độ riêng tư hoặc không công khai dữ liệu học.

## Tiến độ học

Tiến độ được lưu ở `localStorage` của trình duyệt. Muốn đổi máy, dùng nút **Xuất tiến độ** rồi sang máy mới chọn **Nhập tiến độ**.

## Cập nhật 2026-06-22
- Sửa Quiz theo kiểu active recall: không hiện cách đọc/Hán Việt/đáp án ở phần câu hỏi.
- Thêm 4 kiểu quiz: Nhật→nghĩa, nghĩa→Nhật, Kanji→cách đọc, cách đọc→Nhật.
- Đáp án và thông tin phụ chỉ hiện sau khi người học chọn.
