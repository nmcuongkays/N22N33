# Nihongo Memory Coach

App HTML/CSS/JS tĩnh để học N2/N3 theo Active Recall + SRS.

## Cách dùng nhanh

1. Upload toàn bộ thư mục này lên GitHub repository.
2. Vào **Settings → Pages**.
3. Chọn **Deploy from a branch**, branch `main`, folder `/root`.
4. Mở link GitHub Pages.

## Bản sửa hiện tại

- Quiz không hiện đáp án trước khi chọn.
- Thêm **Thiết lập phiên học** ở thanh bên:
  - Kiểu phiên: Review / Thẻ mới / Mixed / Tất cả.
  - Số thẻ/phiên.
  - Mặt trước flashcard: Nhật → Việt, Việt → Nhật, Cách đọc → Nhật, Kanji → cách đọc.
- Thêm **Mục tiêu hôm nay**:
  - Tính số thẻ mới đã học lần đầu trong ngày.
  - Hiện tiến độ dạng thanh.
  - Nút “Học tiếp mục tiêu” chỉ lấy số thẻ còn thiếu trong ngày, tối đa bằng số thẻ/phiên.
- Review không trừ vào mục tiêu thẻ mới, nhưng app vẫn khuyến nghị review trước.

## Lưu ý

Tiến độ được lưu trong `localStorage` của trình duyệt. Nếu đổi máy/trình duyệt, hãy dùng nút **Xuất tiến độ** rồi nhập lại.
