// Synthetic fixtures in the verified provider wire formats.
// Titles/IDs are fabricated — no real provider records.

export function dumpRow(overrides: {
  viewkey?: string;
  title?: string;
  tags?: string;
  categories?: string;
  duration?: string;
  views?: string;
}): string {
  const {
    viewkey = "a1b2c3d4e5f6a7b8c9d0",
    title = "Synthetic demo video title",
    tags = "demo;test;synthetic",
    categories = "Amateur;POV",
    duration = "754",
    views = "12345",
  } = overrides;
  const embed = `<iframe src="https://www.pornhub.com/embed/${viewkey}" frameborder="0" height="481" width="608" scrolling="no"></iframe>`;
  const thumb = "https://ei.phncdn.com/videos/200101/01/1/original/(m=abc)(mh=def)5.jpg";
  const thumbs = `${thumb.replace("5.jpg", "1.jpg")};${thumb.replace("5.jpg", "2.jpg")}`;
  return [
    embed,
    thumb,
    thumbs,
    title,
    tags,
    categories,
    "Test Performer",
    duration,
    views,
    "42",
    "7",
    thumb,
    thumbs,
  ].join("|");
}

export function deletedRow(viewkey = "a1b2c3d4e5f6a7b8c9d0"): string {
  return `12345,${viewkey},https://www.pornhub.com/view_video.php?viewkey=${viewkey}`;
}
