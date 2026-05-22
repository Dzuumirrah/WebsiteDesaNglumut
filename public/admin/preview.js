// admin/preview.js

const resolveImage = (value) => {
  if (!value) {
    return "/assets/img_placeholder1.jpg";
  }

  // object draft dari Decap CMS
  if (typeof value === "object") {
    if (value.path) return value.path;
    if (value.url) return value.url;
  }

  return value;
};

const ImagePreview = ({ entry, getAsset }) => {
  const foto = entry.get("data")?.get("foto");

  const image =
    foto && getAsset
      ? getAsset(foto)?.toString()
      : resolveImage(foto);

  return h(
    "div",
    {
      style: {
        padding: "20px",
        fontFamily: "Arial",
      },
    },
    [
      h("h3", {}, "Preview Gambar"),
      h("img", {
        src: image,
        style: {
          width: "100%",
          maxWidth: "500px",
          borderRadius: "12px",
          objectFit: "cover",
        },
      }),
    ]
  );
};

// register preview untuk semua collection
CMS.registerPreviewTemplate(
  "hero",
  ImagePreview
);

CMS.registerPreviewTemplate(
  "galeri",
  ImagePreview
);

CMS.registerPreviewTemplate(
  "fasilitas",
  ImagePreview
);

CMS.registerPreviewTemplate(
  "sejarah",
  ImagePreview
);