/**
 * The pictures `gallery` shows, in albums. Titles and captions live in
 * `content/gallery.json`; each album is a folder of `src/assets/gallery`,
 * filled with `scripts/picture.py`. An entry whose file is missing fails the
 * build rather than showing a blank.
 */
import entries from '../../content/gallery.json';

export interface PictureEntry {
  /** File name in the album's folder. */
  file: string;
  title: string;
  caption: string;
}

export interface AlbumEntry {
  /** Folder in `src/assets/gallery`; also what `gallery <folder>` is typed with. */
  folder: string;
  title: string;
  description: string;
  pictures: readonly PictureEntry[];
}

export interface GalleryPicture extends PictureEntry {
  /** URL of the built picture. */
  src: string;
}

export interface Album extends Omit<AlbumEntry, 'pictures'> {
  pictures: readonly GalleryPicture[];
}

const files = import.meta.glob<string>('../assets/gallery/*/*.png', {
  eager: true,
  import: 'default',
});

const albums: readonly AlbumEntry[] = entries;

export const gallery: readonly Album[] = albums.map((album) => ({
  ...album,
  pictures: album.pictures.map((picture) => {
    const path = `${album.folder}/${picture.file}`;
    const src = files[`../assets/gallery/${path}`];
    if (!src) throw new Error(`content/gallery.json: no ${path} in src/assets/gallery`);
    return { ...picture, src };
  }),
}));
