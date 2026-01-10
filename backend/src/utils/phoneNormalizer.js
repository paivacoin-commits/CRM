/**
 * Phone Normalizer Utility
 * Normaliza telefones brasileiros para o formato padrão: 55DDNNNNNNNNN
 * 
 * Casos tratados:
 * - Telefones celulares antigos sem o 9º dígito
 * - Telefones com 9 duplicado
 * - Telefones fixos vs celulares
 * - Adiciona DDI 55 quando necessário
 */

/**
 * Normaliza telefone (remove DDI, mantém DDD + número)
 * CORRIGIDO: Não adiciona 9 em telefones fixos e não duplica o 9
 * 
 * @param {string} phone - Telefone para normalizar
 * @returns {string|null} - Telefone normalizado ou null se inválido
 */
export function normalizePhone(phone) {
    if (!phone) return null;
    let n = phone.replace(/\D/g, '');

    // Se já tem 13 dígitos (DDI 55 + DDD + 9 + 8 dígitos), está correto
    if (n.length === 13) {
        return n; // Ex: 5562999981718
    }

    // Se tem 14 ou mais dígitos, pode ter um 9 duplicado - remover
    if (n.length >= 14 && n.startsWith('55')) {
        const ddd = n.substring(2, 4);
        const rest = n.substring(4);

        // Se tem dois 9s seguidos, remover um
        if (rest.startsWith('99')) {
            return '55' + ddd + rest.substring(1, 10); // Remove um 9 e pega só 9 dígitos
        }

        // Se não, pegar apenas os primeiros 13 dígitos
        return n.substring(0, 13);
    }

    // Se tem 12 dígitos (DDI 55 + 10 dígitos sem o 9)
    if (n.length === 12 && n.startsWith('55')) {
        const ddd = n.substring(2, 4);
        const firstDigit = n.charAt(4);

        // Se o primeiro dígito é 6, 7, 8 ou 9, é celular sem o 9
        if (firstDigit === '6' || firstDigit === '7' || firstDigit === '8' || firstDigit === '9') {
            return '55' + ddd + '9' + n.substring(4); // Adiciona o 9
        }
        // Se começa com 2, 3, 4 ou 5, é telefone fixo
        return n;
    }

    // Se tem 11 dígitos (número brasileiro sem DDI), adicionar 55
    if (n.length === 11) {
        return '55' + n;
    }

    // Se tem 10 dígitos, verificar se é celular ou fixo
    if (n.length === 10) {
        const ddd = n.substring(0, 2);
        const firstDigit = n.charAt(2);

        // Se o primeiro dígito do número é 9, 8 ou 7, é celular antigo
        if (firstDigit === '9' || firstDigit === '8' || firstDigit === '7') {
            // É celular antigo sem o 9 - adicionar 9 e DDI 55
            return '55' + ddd + '9' + n.substring(2);
        }
        // Se começa com 2, 3, 4, 5 ou 6, é telefone FIXO - adicionar DDI 55
        return '55' + n;
    }

    // Para números com menos de 10 dígitos, retornar null (inválido)
    if (n.length < 10) {
        return null;
    }

    return n;
}
