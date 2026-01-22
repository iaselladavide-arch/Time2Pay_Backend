import React from 'react';
import { Text, View, StyleSheet, Platform } from 'react-native';

// Mappatura completa a caratteri/testo per fallback
const TEXT_ICONS: Record<string, string> = {
  // === Icone Navigation/Tab Bar ===
  'house': '⌂',
  'house.fill': '⌂',
  'dollarsign.circle': '$○',
  'dollarsign.circle.fill': '$●',
  'euro': '€',
  'person': '👤',
  'person.fill': '👤',
  'person.circle': '○',
  'person.circle.fill': '●',
  
  // === Icone per Spese/Expenses ===
  'creditcard': '💳',
  'creditcard.fill': '💳',
  'banknote': '💵',
  'banknote.fill': '💵',
  'cart': '🛒',
  'cart.fill': '🛒',
  'tag': '🏷️',
  'tag.fill': '🏷️',
  
  // === Frecce ===
  'chevron.right': '→',
  'chevron.left': '←', 
  'chevron.down': '↓',
  'chevron.up': '↑',
  'arrow.right': '→',
  'arrow.left': '←',
  'arrow.up': '↑',
  'arrow.down': '↓',
  'arrow.up.down': '⇅',
  
  // === Azioni ===
  'plus': '+',
  'plus.circle': '⊕',
  'plus.circle.fill': '⊕',
  'minus': '−',
  'minus.circle': '⊖',
  'xmark': '×',
  'xmark.circle': '⊗',
  'xmark.circle.fill': '⊗',
  'checkmark': '✓',
  'checkmark.circle': '○✓',
  'checkmark.circle.fill': '●✓',
  'trash': '🗑️',
  'trash.fill': '🗑️',
  'pencil': '✏️',
  'pencil.circle': '✏○',
  
  // === Persone ===
  'person.2': '👥',
  'person.3': '👥',
  'person.slash': '⛔',
  'person.badge.plus': '👤+',
  
  // === File e Documenti ===
  'doc': '📄',
  'doc.fill': '📄',
  'folder': '📁',
  'folder.fill': '📁',
  'paperplane': '✈',
  'paperplane.fill': '✈',

  
  // === UI e Navigazione ===
  'magnifyingglass': '🔍',
  'info.circle': 'ⓘ',
  'info.circle.fill': 'ⓘ',
  'questionmark.circle': '❓',
  'questionmark.circle.fill': '❓',
  'exclamationmark.circle': '❗',
  'exclamationmark.triangle': '⚠️',
  'bell': '🔔',
  'bell.fill': '🔔',
  'gear': '⚙️',
  'gear.fill': '⚙️',
  'slider.horizontal.3': '⋮',
  
  // === Media ===
  'camera': '📷',
  'camera.fill': '📷',
  'photo': '🖼️',
  'photo.fill': '🖼️',
  
  // === Comunicazione ===
  'message': '💬',
  'message.fill': '💬',
  'phone': '📞',
  'phone.fill': '📞',
  'envelope': '✉️',
  'envelope.fill': '✉️',
  
  // === Varie ===
  'heart': '❤️',
  'heart.fill': '❤️',
  'star': '★',
  'star.fill': '★',
  'bookmark': '🔖',
  'bookmark.fill': '🔖',
  'flag': '🚩',
  'flag.fill': '🚩',
  'location': '📍',
  'location.fill': '📍',
  'clock': '🕒',
  'clock.fill': '🕒',
  'calendar': '📅',
  'calendar.badge.plus': '📅+',
  
  // === Tecnologia ===
  'wifi': '📶',
  'battery.100': '🔋',
  'bolt': '⚡',
  'bolt.fill': '⚡',
  
  // === Fallback ===
  'text.alignleft': '📝',
  'chevron.left.forwardslash.chevron.right': '</>',
};

// Mappatura per @expo/vector-icons (MaterialIcons)
const MATERIAL_MAPPING: Record<string, string> = {
  // === Tab Bar ===
  'house': 'home',
  'house.fill': 'home',
  'dollarsign.circle': 'attach-money',
  'dollarsign.circle.fill': 'attach-money',
  'person': 'person',
  'person.fill': 'person',
  'person.circle': 'account-circle',
  'person.circle.fill': 'account-circle',
  
  // === Frecce ===
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.down': 'keyboard-arrow-down',
  'chevron.up': 'keyboard-arrow-up',
  'arrow.right': 'arrow-forward',
  'arrow.left': 'arrow-back',
  'arrow.up': 'arrow-upward',
  'arrow.down': 'arrow-downward',
  
  // === Azioni ===
  'plus': 'add',
  'plus.circle': 'add-circle',
  'plus.circle.fill': 'add-circle',
  'minus': 'remove',
  'minus.circle': 'remove-circle',
  'xmark': 'close',
  'xmark.circle': 'cancel',
  'xmark.circle.fill': 'cancel',
  'checkmark': 'check',
  'checkmark.circle': 'check-circle-outline',
  'checkmark.circle.fill': 'check-circle',
  'trash': 'delete',
  'trash.fill': 'delete',
  'pencil': 'edit',
  'pencil.circle': 'edit',
  
  // === File e Documenti ===
  'doc': 'description',
  'doc.fill': 'description',
  'folder': 'folder',
  'folder.fill': 'folder',
  'paperplane': 'send',
  'paperplane.fill': 'send',
  
  // === UI ===
  'magnifyingglass': 'search',
  'info.circle': 'info',
  'info.circle.fill': 'info',
  'questionmark.circle': 'help-outline',
  'questionmark.circle.fill': 'help',
  'exclamationmark.circle': 'error-outline',
  'exclamationmark.triangle': 'warning',
  'bell': 'notifications',
  'bell.fill': 'notifications',
  'gear': 'settings',
  'gear.fill': 'settings',
  'slider.horizontal.3': 'more-vert',
  
  // === Persone ===
  'person.2': 'group',
  'person.3': 'groups',
  'person.slash': 'person-off',
  'person.badge.plus': 'person-add',
  
  // === Media ===
  'camera': 'photo-camera',
  'camera.fill': 'photo-camera',
  'photo': 'photo',
  'photo.fill': 'photo',
  
  // === Comunicazione ===
  'message': 'message',
  'message.fill': 'message',
  'phone': 'phone',
  'phone.fill': 'phone',
  'envelope': 'email',
  'envelope.fill': 'email',
  
  // === Varie ===
  'heart': 'favorite-border',
  'heart.fill': 'favorite',
  'star': 'star-border',
  'star.fill': 'star',
  'bookmark': 'bookmark-border',
  'bookmark.fill': 'bookmark',
  'flag': 'flag',
  'flag.fill': 'flag',
  'location': 'location-on',
  'location.fill': 'location-on',
  'clock': 'access-time',
  'clock.fill': 'access-time',
  'calendar': 'calendar-today',
  'calendar.badge.plus': 'event-available',
  
  // === Tecnologia ===
  'wifi': 'wifi',
  'battery.100': 'battery-full',
  'bolt': 'flash-on',
  'bolt.fill': 'flash-on',
  
  // === Spese/Finanze ===
  'creditcard': 'credit-card',
  'creditcard.fill': 'credit-card',
  'banknote': 'payments',
  'banknote.fill': 'payments',
  'cart': 'shopping-cart',
  'cart.fill': 'shopping-cart',
  'tag': 'local-offer',
  'tag.fill': 'local-offer',
};

interface IconSymbolProps {
  name: string;
  size?: number;
  color: string;
  style?: any;
  weight?: string;
  fallbackName?: string;
}

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
  fallbackName = 'questionmark.circle',
}: IconSymbolProps) {
  
  // 1. Tentativo con @expo/vector-icons (MaterialIcons)
  let MaterialIconComponent = null;
  try {
    const MaterialIcons = require('@expo/vector-icons/MaterialIcons');
    MaterialIconComponent = MaterialIcons.default || MaterialIcons;
  } catch (error) {
    // @expo/vector-icons non disponibile, continuiamo con fallback
  }
  
  if (MaterialIconComponent) {
    const materialName = MATERIAL_MAPPING[name];
    if (materialName) {
      return (
        <MaterialIconComponent 
          name={materialName} 
          size={size} 
          color={color} 
          style={style} 
        />
      );
    }
  }
  
  // 2. Fallback a caratteri/texto
  let iconChar = TEXT_ICONS[name];
  
  // 3. Se icona non trovata, usa fallback
  if (!iconChar) {
    console.warn(`[IconSymbol] Icona "${name}" non trovata, usando fallback`);
    iconChar = TEXT_ICONS[fallbackName] || '?';
  }
  
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Text 
        style={[
          styles.iconText, 
          { 
            fontSize: size * 0.7, 
            color,
            lineHeight: size * 0.85, // Migliora il centramento verticale
          }
        ]}
        allowFontScaling={false}
      >
        {iconChar}
      </Text>
    </View>
  );
}

// Funzione helper per verificare se un'icona è disponibile
export function hasIcon(name: string): boolean {
  return !!(TEXT_ICONS[name] || MATERIAL_MAPPING[name]);
}

// Funzione per ottenere tutte le icone disponibili
export function getAvailableIcons(): string[] {
  const allIcons = new Set<string>();
  
  // Aggiungi icone da TEXT_ICONS
  Object.keys(TEXT_ICONS).forEach(icon => allIcons.add(icon));
  
  // Aggiungi icone da MATERIAL_MAPPING
  Object.keys(MATERIAL_MAPPING).forEach(icon => allIcons.add(icon));
  
  return Array.from(allIcons).sort();
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconText: {
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontWeight: 'normal',
  },
});

// Esporta le costanti per uso esterno
export { TEXT_ICONS, MATERIAL_MAPPING };