import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getScoreLevel } from './constants'
import type { CandidateFullDetail } from './types'

const GREEN  = '00C4A0'
const DARK   = '1E2A3A'
const GRAY   = '718096'
const LGRAY  = 'A0AEC0'
const WHITE  = 'FFFFFF'
const BGBOT  = 'F0F4F8'
const BGUSER = 'E0F7F4'

function noBorders() {
  const s = { style: BorderStyle.NONE, size: 0, color: 'auto' }
  return { top: s, bottom: s, left: s, right: s, insideH: s, insideV: s }
}

function infoRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 28, type: WidthType.PERCENTAGE },
        borders: noBorders(),
        margins: { top: 80, bottom: 80, left: 0, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: label, bold: true, size: 20, color: GRAY, font: 'Calibri' })],
        })],
      }),
      new TableCell({
        width: { size: 72, type: WidthType.PERCENTAGE },
        borders: noBorders(),
        margins: { top: 80, bottom: 80, left: 0, right: 0 },
        children: [new Paragraph({
          children: [new TextRun({ text: value, size: 20, color: DARK, font: 'Calibri' })],
        })],
      }),
    ],
  })
}

function sectionTitle(text: string, color = DARK): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color, allCaps: true, font: 'Calibri' })],
    spacing: { before: 320, after: 160 },
  })
}

function divider(color = 'E2E8F0'): Paragraph {
  return new Paragraph({
    text: '',
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color } },
    spacing: { before: 200, after: 300 },
  })
}

function msgBlock(role: string, content: string, time: string): Table {
  const isBot = role === 'assistant'
  const roleLabel = isBot ? 'Cliente simulado' : 'Candidato — Agente de soporte'
  const bgFill = isBot ? BGBOT : BGUSER
  const labelColor = isBot ? DARK : GREEN

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: bgFill, type: ShadingType.CLEAR, color: 'auto' },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: noBorders(),
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: roleLabel, bold: true, size: 18, color: labelColor, font: 'Calibri' }),
                  new TextRun({ text: `   ${time}`, size: 17, color: LGRAY, font: 'Calibri' }),
                ],
                spacing: { after: 80 },
              }),
              new Paragraph({
                children: [new TextRun({ text: content, size: 20, color: DARK, font: 'Calibri' })],
                spacing: { after: 0 },
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

export async function generateConversationDoc(candidate: CandidateFullDetail): Promise<Blob> {
  const challenge = candidate.challenges[0]
  const messages  = (challenge?.messages ?? []).filter(m => m.role !== 'system')
  const scoreInfo = challenge?.score != null ? getScoreLevel(challenge.score) : null
  const scoreText = challenge?.score != null
    ? `${challenge.score.toFixed(1)} / 10  —  ${scoreInfo?.label ?? ''}`
    : 'Sin puntaje'
  const completedText = challenge?.completedAt
    ? format(new Date(challenge.completedAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })
    : 'No completada'

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: DARK },
          paragraph: { spacing: { after: 160 } },
        },
      },
    },
    sections: [{
      properties: {},
      children: [

        /* ── ENCABEZADO ── */
        new Paragraph({
          children: [new TextRun({ text: 'ALEGRA TALENT', bold: true, size: 44, color: GREEN, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Reporte de Evaluación de Candidato', size: 24, color: GRAY, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}`, size: 18, color: LGRAY, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 0 },
        }),
        divider(GREEN),

        /* ── DATOS DEL CANDIDATO ── */
        sectionTitle('Información del candidato'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders(),
          rows: [
            infoRow('Nombre',            candidate.name),
            infoRow('Correo',            candidate.email),
            infoRow('ID Teamtailor',     candidate.teamtailorId),
            infoRow('Fecha evaluación',  completedText),
            infoRow('Puntaje final',     scoreText),
          ],
        }),
        divider(),

        /* ── RESUMEN ── */
        ...(challenge?.feedback ? [
          sectionTitle('Resumen de evaluación'),
          new Paragraph({
            children: [new TextRun({ text: challenge.feedback, size: 22, color: GRAY, font: 'Calibri' })],
            spacing: { after: 0 },
          }),
          divider(),
        ] : []),

        /* ── FORTALEZAS ── */
        ...(challenge?.strengths?.length > 0 ? [
          sectionTitle('Fortalezas', GREEN),
          ...challenge.strengths.map(s => new Paragraph({
            children: [
              new TextRun({ text: '+  ', bold: true, color: GREEN, size: 22, font: 'Calibri' }),
              new TextRun({ text: s, size: 22, color: DARK, font: 'Calibri' }),
            ],
            spacing: { after: 100 },
          })),
        ] : []),

        /* ── ÁREAS DE MEJORA ── */
        ...(challenge?.improvements?.length > 0 ? [
          sectionTitle('Áreas de mejora', GRAY),
          ...challenge.improvements.map(s => new Paragraph({
            children: [
              new TextRun({ text: '→  ', bold: true, color: GRAY, size: 22, font: 'Calibri' }),
              new TextRun({ text: s, size: 22, color: DARK, font: 'Calibri' }),
            ],
            spacing: { after: 100 },
          })),
          divider(),
        ] : []),

        /* ── TRANSCRIPCIÓN ── */
        sectionTitle('Transcripción de la conversación'),
        new Paragraph({
          children: [new TextRun({ text: `${messages.length} mensajes`, size: 18, color: LGRAY, font: 'Calibri' })],
          spacing: { after: 240 },
        }),
        ...messages.flatMap((msg, i) => {
          const time = format(new Date(msg.createdAt), 'HH:mm', { locale: es })
          return [
            msgBlock(msg.role, msg.content, time),
            new Paragraph({ text: '', spacing: { after: 140 } }),
          ]
        }),

        /* ── PIE ── */
        divider(),
        new Paragraph({
          children: [
            new TextRun({
              text: `Alegra Talent Bot  ·  Evaluación #{${candidate.id.slice(-8).toUpperCase()}}`,
              size: 17,
              color: LGRAY,
              font: 'Calibri',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 0 },
        }),
      ],
    }],
  })

  return Packer.toBlob(doc)
}
