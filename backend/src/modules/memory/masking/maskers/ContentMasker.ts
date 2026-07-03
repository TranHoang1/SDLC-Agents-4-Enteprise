import { CodeBlock, DetectionResult, SensitivityLevel } from '../models/MaskingTypes.js';

const CODE_BLOCK_RE = /```[\s\S]*?```/g;

/**
 * Applies masking transformations to content.
 * Extracts code blocks first to preserve them, then applies masking.
 */
export class ContentMasker {

  applyMasking(
    content: string,
    detections: DetectionResult[],
    role: string,
    level: SensitivityLevel,
    reveal: boolean
  ): string {
    if (reveal && role === 'ADMIN') return content;

    const { text, blocks } = this.extractCodeBlocks(content);
    let masked = text;

    const sorted = [...detections].sort((a, b) => b.start - a.start);

    for (const det of sorted) {
      if (this.isInCodeBlock(det.start, blocks)) continue;
      const replacement = this.getMaskFormat(det);
      masked = masked.slice(0, det.start) + replacement + masked.slice(det.end);
    }

    return this.restoreCodeBlocks(masked, blocks);
  }

  extractCodeBlocks(content: string): { text: string; blocks: CodeBlock[] } {
    const blocks: CodeBlock[] = [];
    let idx = 0;
    const text = content.replace(CODE_BLOCK_RE, (match, offset) => {
      const placeholder = `__CODE_BLOCK_${idx}__`;
      blocks.push({ placeholder, original: match, start: offset, end: offset + match.length });
      idx++;
      return placeholder;
    });
    return { text, blocks };
  }

  restoreCodeBlocks(content: string, blocks: CodeBlock[]): string {
    let result = content;
    for (const b of blocks) {
      result = result.replace(b.placeholder, b.original);
    }
    return result;
  }

  private isInCodeBlock(pos: number, blocks: CodeBlock[]): boolean {
    return blocks.some(b => pos >= b.start && pos < b.end);
  }

  private getMaskFormat(det: DetectionResult): string {
    switch (det.type) {
      case 'email': return this.maskEmail(det.match);
      case 'phone': return this.maskPhone(det.match);
      case 'ip': return this.maskIp(det.match);
      case 'credit_card': return this.maskCreditCard(det.match);
      case 'ssn': return this.maskSsn(det.match);
      case 'api_key': return this.maskApiKey(det.match);
      case 'jwt': return 'eyJ***[REDACTED]';
      case 'password': return '[REDACTED]';
      case 'connection_string': return this.maskConnString(det.match);
      case 'private_key': return '[REDACTED_KEY]';
      default: return '[REDACTED]';
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    const parts = domain.split('.');
    const tld = parts[parts.length - 1];
    return `${local[0]}***@${parts[0][0]}***.${tld}`;
  }

  private maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    const last4 = digits.slice(-4);
    return `+*-***-***-${last4}`;
  }

  private maskIp(ip: string): string {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.*.*`;
  }

  private maskCreditCard(cc: string): string {
    const digits = cc.replace(/\D/g, '');
    return `****-****-****-${digits.slice(-4)}`;
  }

  private maskSsn(ssn: string): string {
    const digits = ssn.replace(/\D/g, '');
    return `***-**-${digits.slice(-4)}`;
  }

  private maskApiKey(key: string): string {
    const dashIdx = key.indexOf('-');
    const prefix = dashIdx > 0 ? key.slice(0, dashIdx + 1) : key.slice(0, 4);
    return `${prefix}***[REDACTED]`;
  }

  private maskConnString(conn: string): string {
    return conn.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@');
  }
}
