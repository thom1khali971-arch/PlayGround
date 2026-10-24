package com.thomlol.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.List;
import java.util.Locale;

public class MediaFileProvider extends ContentProvider {

    private static final String AUTHORITY_SUFFIX = ".files";
    private static final String MEDIA_DIR = "media";

    public static Uri getUriForFile(Context context, File file) {
        return new Uri.Builder()
                .scheme("content")
                .authority(context.getPackageName() + AUTHORITY_SUFFIX)
                .appendPath(MEDIA_DIR)
                .appendPath(file.getName())
                .build();
    }

    private File resolve(Uri uri) {
        if (uri == null) return null;
        String expectedAuthority = getContext().getPackageName() + AUTHORITY_SUFFIX;
        if (!expectedAuthority.equals(uri.getAuthority())) return null;
        List<String> segments = uri.getPathSegments();
        if (segments == null || segments.size() != 2) return null;
        if (!MEDIA_DIR.equals(segments.get(0))) return null;
        File dir = new File(getContext().getCacheDir(), MEDIA_DIR);
        return new File(dir, segments.get(1));
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(
            Uri uri,
            String[] projection,
            String selection,
            String[] selectionArgs,
            String sortOrder) {
        File file = resolve(uri);
        if (file == null || !file.exists()) return null;

        String[] columns = projection != null
                ? projection
                : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        Object[] row = new Object[columns.length];
        for (int i = 0; i < columns.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) {
                row[i] = file.getName();
            } else if (OpenableColumns.SIZE.equals(columns[i])) {
                row[i] = file.length();
            } else {
                row[i] = null;
            }
        }
        cursor.addRow(row);
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        File file = resolve(uri);
        if (file == null) return "application/octet-stream";
        String name = file.getName();
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return "application/octet-stream";
        String extension = name.substring(dot + 1).toLowerCase(Locale.ROOT);
        String type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
        return type != null ? type : "application/octet-stream";
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = resolve(uri);
        if (file == null) throw new FileNotFoundException("Invalid media URI");
        File parent = file.getParentFile();
        if (parent != null && !parent.exists()) parent.mkdirs();

        int flags = ParcelFileDescriptor.MODE_READ_ONLY;
        if (mode != null && mode.contains("w")) {
            flags = ParcelFileDescriptor.MODE_READ_WRITE
                    | ParcelFileDescriptor.MODE_CREATE
                    | ParcelFileDescriptor.MODE_TRUNCATE;
        }
        return ParcelFileDescriptor.open(file, flags);
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
