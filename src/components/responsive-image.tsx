import NextImage, { type ImageProps } from "next/image";
import { preload as preloadResource } from "react-dom";
import { responsiveAssets, responsiveWidths } from "@/lib/responsive-assets";
type Props = Pick<
  ImageProps,
  | "src"
  | "alt"
  | "width"
  | "height"
  | "sizes"
  | "loading"
  | "fetchPriority"
  | "preload"
  | "unoptimized"
  | "className"
  | "style"
>;
/** Prepared local photography uses native responsive discovery and needs no
 * image-optimizer request or JavaScript image-load handler on the critical path.
 * New uploads/remote assets retain Next's existing delivery path. */
export default function ResponsiveImage({
  src,
  alt,
  width,
  height,
  sizes,
  loading,
  fetchPriority,
  preload,
  unoptimized,
  className,
  style,
}: Props) {
  const match =
    typeof src === "string" ? /^\/images\/([a-z0-9-]+)\.webp$/.exec(src) : null;
  if (!match || !(responsiveAssets as readonly string[]).includes(match[1]))
    return (
      <NextImage
        {...{
          src,
          alt,
          width,
          height,
          sizes,
          loading,
          fetchPriority,
          preload,
          unoptimized,
          className,
          style,
        }}
      />
    );
  const name = match[1],
    srcSet = responsiveWidths
      .map((w) => `/images/responsive/${name}-${w}.webp ${w}w`)
      .join(", "),
    fallback = `/images/responsive/${name}-828.webp`;
  if (preload)
    preloadResource(fallback, {
      as: "image",
      imageSrcSet: srcSet,
      imageSizes: sizes,
      fetchPriority: "high",
    });
  return (
    <img
      src={fallback}
      srcSet={srcSet}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      loading={preload ? "eager" : loading || "lazy"}
      fetchPriority={preload ? "high" : fetchPriority}
      decoding="async"
      className={className}
      style={style}
    />
  );
}
