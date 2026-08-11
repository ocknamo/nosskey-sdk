import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadTextFile } from './download-file.js';

describe('downloadTextFile', () => {
  let createdAnchor: HTMLAnchorElement;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    // 実 DOM の click() はナビゲーションを誘発するため anchor 生成を差し替える。
    createdAnchor = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(createdAnchor);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers a download with the given filename and revokes the object URL', () => {
    downloadTextFile('{"a":1}', 'backup.json');

    expect(createdAnchor.download).toBe('backup.json');
    expect(createdAnchor.href).toBe('blob:mock');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('uses the provided MIME type when building the blob', () => {
    downloadTextFile('plain', 'note.txt', 'text/plain');

    const blobArg = (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Blob;
    expect(blobArg.type).toBe('text/plain');
  });
});
