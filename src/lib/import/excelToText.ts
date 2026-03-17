import { read, utils } from 'xlsx'

/**
 * Read an Excel file (.xlsx / .xls) and return its first sheet as CSV text.
 * Falls back to reading as UTF-8 text for .csv / .txt / .tsv files.
 */
export async function fileToText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer()
    const workbook = read(buffer, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!firstSheet) throw new Error('Excel bestand bevat geen werkbladen.')
    return utils.sheet_to_csv(firstSheet, { FS: ',', RS: '\n' })
  }

  // CSV / TXT / TSV — read as text
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Kan bestand niet lezen.'))
    reader.readAsText(file, 'UTF-8')
  })
}

const SUPPORTED_EXTENSIONS = ['csv', 'txt', 'tsv', 'xlsx', 'xls']

export function isSupportedFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return SUPPORTED_EXTENSIONS.includes(ext)
}
