from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


# ==================== 品牌资源生成 ====================
# 这份脚本从用户确认的视觉稿提取真实轮廓，再统一换成项目色并缩放。
# 手机和手表共用同一份轮廓，可以避免不同尺寸被分别手画后出现形状偏差。

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
BRAND_ROOT = Path(__file__).resolve().parent
SOURCE_BOARD = BRAND_ROOT / "source" / "nutritime-logo-selected-board.png"

APP_GREEN = (99, 209, 138, 255)
DEEP_GREEN = (66, 101, 97, 255)
CORAL = (255, 120, 106, 255)
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)

# 确认稿中左上大图标的位置固定在这块区域；只提取这一区域可避开字标和色卡。
SOURCE_ICON_BOX = (192, 59, 964, 831)
MASTER_SIZE = 1024
# Adaptive Icon（Android 会按桌面主题裁成不同外形的图标）使用 108×108 的前景层。
# 各设备只保证中央 66×66 的安全区完整显示；缩小整层后，标志原有的透明边距会让真实轮廓留在区内。
ADAPTIVE_ICON_MARK_SIZE = round(MASTER_SIZE * 0.75)

APP_EXPORT_SIZES = (1024, 512, 256, 192, 144, 128, 96, 72, 64, 48, 32)
WATCH_EXPORT_SIZES = (512, 256, 192, 144, 96, 72, 48, 32)
MARK_EXPORT_SIZES = (512, 256, 128, 64, 48, 32, 24)
WEAR_DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def extract_mark_masks() -> tuple[Image.Image, Image.Image]:
    source = Image.open(SOURCE_BOARD).convert("RGB").crop(SOURCE_ICON_BOX)
    width, height = source.size
    center_x = (width - 1) / 2
    center_y = (height - 1) / 2
    safe_radius = min(width, height) * 0.44

    white_mask = Image.new("L", source.size)
    coral_mask = Image.new("L", source.size)
    white_pixels: list[int] = []
    coral_pixels: list[int] = []

    # 确认稿带有轻微的展示光感，不能直接把整张图缩成图标。
    # 这里按颜色提取白色圆环、叶片和珊瑚色圆点，再换成纯色，桌面小图标才不会发灰。
    for index, (red, green, blue) in enumerate(source.get_flattened_data()):
        x = index % width
        y = index // width
        inside_safe_area = (x - center_x) ** 2 + (y - center_y) ** 2 <= safe_radius**2

        if not inside_safe_area:
            white_pixels.append(0)
            coral_pixels.append(0)
            continue

        minimum_channel = min(red, green, blue)
        color_range = max(red, green, blue) - minimum_channel
        white_strength = clamp((minimum_channel - 150) / 85) * clamp((115 - color_range) / 80)

        coral_difference = red - max(green, blue)
        coral_strength = clamp((coral_difference - 20) / 95) * clamp((red - 170) / 70)

        white_pixels.append(round(255 * white_strength) if white_strength >= 0.08 else 0)
        coral_pixels.append(round(255 * coral_strength) if coral_strength >= 0.08 else 0)

    white_mask.putdata(white_pixels)
    coral_mask.putdata(coral_pixels)

    return (
        white_mask.resize((MASTER_SIZE, MASTER_SIZE), Image.Resampling.LANCZOS),
        coral_mask.resize((MASTER_SIZE, MASTER_SIZE), Image.Resampling.LANCZOS),
    )


def create_mark(
    white_mask: Image.Image,
    coral_mask: Image.Image,
    main_color: tuple[int, int, int, int],
    coral_color: tuple[int, int, int, int] | None = CORAL,
) -> Image.Image:
    mark = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), TRANSPARENT)
    mark.paste(Image.new("RGBA", mark.size, main_color), mask=white_mask)

    if coral_color is None:
        # 系统单色图标只看外形，不保留彩色圆点；把两块轮廓合并后由系统统一着色。
        mark.paste(Image.new("RGBA", mark.size, main_color), mask=coral_mask)
    else:
        mark.paste(Image.new("RGBA", mark.size, coral_color), mask=coral_mask)

    return mark


def create_background_icon(mark: Image.Image, shape: str) -> Image.Image:
    icon = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), TRANSPARENT)
    draw = ImageDraw.Draw(icon)

    if shape == "square":
        draw.rectangle((0, 0, MASTER_SIZE, MASTER_SIZE), fill=APP_GREEN)
    elif shape == "rounded":
        draw.rounded_rectangle(
            (0, 0, MASTER_SIZE - 1, MASTER_SIZE - 1),
            radius=round(MASTER_SIZE * 0.185),
            fill=APP_GREEN,
        )
    elif shape == "round":
        draw.ellipse((0, 0, MASTER_SIZE - 1, MASTER_SIZE - 1), fill=APP_GREEN)
    else:
        raise ValueError(f"不支持的图标外形：{shape}")

    icon.alpha_composite(mark)
    return icon


def create_adaptive_icon_foreground(mark: Image.Image) -> Image.Image:
    foreground = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), TRANSPARENT)
    resized_mark = mark.resize(
        (ADAPTIVE_ICON_MARK_SIZE, ADAPTIVE_ICON_MARK_SIZE),
        Image.Resampling.LANCZOS,
    )
    offset = (MASTER_SIZE - ADAPTIVE_ICON_MARK_SIZE) // 2

    foreground.alpha_composite(resized_mark, (offset, offset))
    return foreground


def save_png(image: Image.Image, path: Path, size: int | tuple[int, int] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    output = image

    if isinstance(size, int):
        output = image.resize((size, size), Image.Resampling.LANCZOS)
    elif size is not None:
        output = image.resize(size, Image.Resampling.LANCZOS)

    output.save(path, format="PNG", optimize=True)


def create_wordmark(mark: Image.Image, text_color: tuple[int, int, int, int]) -> Image.Image:
    canvas = Image.new("RGBA", (2048, 512), TRANSPARENT)
    mark_size = 380
    canvas.alpha_composite(
        mark.resize((mark_size, mark_size), Image.Resampling.LANCZOS),
        (36, (canvas.height - mark_size) // 2),
    )

    font_path = REPOSITORY_ROOT / "apps" / "mobile" / "assets" / "fonts" / "Quicksand-Bold.ttf"
    font = ImageFont.truetype(str(font_path), 260)
    draw = ImageDraw.Draw(canvas)
    text = "NutriTime"
    text_box = draw.textbbox((0, 0), text, font=font)
    text_height = text_box[3] - text_box[1]
    text_y = (canvas.height - text_height) // 2 - text_box[1]
    draw.text((450, text_y), text, font=font, fill=text_color)
    return canvas


def create_splash_lockup(mark: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), TRANSPARENT)
    mark_size = 420
    canvas.alpha_composite(
        mark.resize((mark_size, mark_size), Image.Resampling.LANCZOS),
        ((canvas.width - mark_size) // 2, 170),
    )

    font_path = REPOSITORY_ROOT / "apps" / "mobile" / "assets" / "fonts" / "Quicksand-Bold.ttf"
    font = ImageFont.truetype(str(font_path), 140)
    draw = ImageDraw.Draw(canvas)
    text = "NutriTime"
    text_box = draw.textbbox((0, 0), text, font=font)
    text_width = text_box[2] - text_box[0]

    # Android 会把启动图限制在屏幕中央；竖向排列能让标志和名称都保持清楚，不会把横向字标缩得过小。
    draw.text(
        ((canvas.width - text_width) // 2 - text_box[0], 680 - text_box[1]),
        text,
        font=font,
        fill=WHITE,
    )
    return canvas


def save_wear_webp(image: Image.Image, path: Path, size: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    resized = image.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(path, format="WEBP", lossless=True, quality=100, method=6)


def main() -> None:
    white_mask, coral_mask = extract_mark_masks()
    color_mark = create_mark(white_mask, coral_mask, WHITE)
    dark_mark = create_mark(white_mask, coral_mask, DEEP_GREEN)
    monochrome_mark = create_mark(white_mask, coral_mask, WHITE, coral_color=None)
    adaptive_color_mark = create_adaptive_icon_foreground(color_mark)
    adaptive_monochrome_mark = create_adaptive_icon_foreground(monochrome_mark)

    square_icon = create_background_icon(color_mark, "square")
    rounded_icon = create_background_icon(color_mark, "rounded")
    watch_icon = create_background_icon(color_mark, "round")

    masters = BRAND_ROOT / "masters"
    save_png(square_icon, masters / "nutritime-app-icon-1024.png")
    save_png(rounded_icon, masters / "nutritime-app-icon-rounded-1024.png")
    save_png(watch_icon, masters / "nutritime-watch-icon-1024.png")
    save_png(color_mark, masters / "nutritime-mark-color-1024.png")
    save_png(dark_mark, masters / "nutritime-mark-dark-1024.png")
    save_png(monochrome_mark, masters / "nutritime-mark-monochrome-1024.png")
    save_png(create_wordmark(dark_mark, DEEP_GREEN), masters / "nutritime-wordmark-color-2048x512.png")
    save_png(
        create_wordmark(monochrome_mark, WHITE),
        masters / "nutritime-wordmark-white-2048x512.png",
    )

    for size in APP_EXPORT_SIZES:
        save_png(square_icon, BRAND_ROOT / "exports" / "app" / f"nutritime-app-icon-{size}.png", size)

    for size in WATCH_EXPORT_SIZES:
        save_png(watch_icon, BRAND_ROOT / "exports" / "watch" / f"nutritime-watch-icon-{size}.png", size)

    for size in MARK_EXPORT_SIZES:
        save_png(dark_mark, BRAND_ROOT / "exports" / "mark" / f"nutritime-mark-dark-{size}.png", size)

    mobile_assets = REPOSITORY_ROOT / "apps" / "mobile" / "assets" / "branding"
    save_png(square_icon, mobile_assets / "app-icon.png")
    save_png(adaptive_color_mark, mobile_assets / "adaptive-icon-foreground.png")
    save_png(adaptive_monochrome_mark, mobile_assets / "adaptive-icon-monochrome.png")
    save_png(create_splash_lockup(color_mark), mobile_assets / "splash-icon.png")

    wear_res = REPOSITORY_ROOT / "apps" / "wear" / "app" / "src" / "main" / "res"
    save_png(color_mark, wear_res / "drawable-nodpi" / "nutritime_logo_foreground.png", 432)

    for density, size in WEAR_DENSITIES.items():
        save_wear_webp(rounded_icon, wear_res / density / "ic_launcher.webp", size)
        save_wear_webp(watch_icon, wear_res / density / "ic_launcher_round.webp", size)


if __name__ == "__main__":
    main()
