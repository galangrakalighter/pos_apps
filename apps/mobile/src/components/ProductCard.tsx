import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../theme';
import { Product } from '../types';
import { rupiah } from '../data/mock';

interface Props { product: Product; onAdd: (product: Product) => void; compact?: boolean; showPrice?: boolean; hideStock?: boolean; ignoreStock?: boolean; selectedQuantity?: number; }

export function ProductCard({ product, onAdd, compact, showPrice = true, hideStock = false, ignoreStock = false, selectedQuantity = 0 }: Props) {
  const soldOut = product.isAvailable === false || (!ignoreStock && product.stock <= 0) || (product.kind === 'produk_jadi' && product.price <= 0);
  const shouldShowPrice = showPrice || product.price > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tambah ${product.name} ke keranjang`}
      disabled={soldOut}
      onPress={() => onAdd(product)}
      style={({ pressed }) => [styles.card, compact && styles.compact, pressed && styles.pressed, soldOut && styles.disabled]}
    >
      <View style={[styles.art, { backgroundColor: product.color }]}>
        {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="cover" /> : <Text style={styles.artText}>{product.name.slice(0, 1)}</Text>}
        {!hideStock && <View style={styles.stockBadge}><Text style={styles.stockText}>{`Stok ${product.stock}${product.kind === 'bahan_baku' && product.unit ? ` ${product.unit}` : ''}`}</Text></View>}
        {product.isAvailable === false && <View style={styles.unavailableBadge}><Text style={styles.unavailableText}>Tidak tersedia</Text></View>}
        {selectedQuantity > 0 && <View style={styles.quantityBadge}><Text style={styles.quantityBadgeText}>{selectedQuantity} dipesan</Text></View>}
      </View>
      <View style={styles.body}>
        <Text style={styles.category}>{product.category}</Text>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <View style={styles.footer}>
          {shouldShowPrice ? <Text style={styles.price}>{rupiah(product.price)}</Text> : <Text style={styles.price}>Quantity</Text>}
          <View style={styles.add}><Text style={styles.addText}>＋</Text></View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 145, maxWidth: 230, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden', ...shadow },
  compact: { minWidth: 130 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  art: { height: 88, alignItems: 'center', justifyContent: 'center' },
  artText: { fontSize: 34, fontWeight: '900', color: colors.ink, opacity: 0.72 },
  image: { width: '100%', height: '100%' },
  stockBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.88)', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  stockText: { fontSize: 10, fontWeight: '700', color: colors.ink },
  unavailableBadge: { position: 'absolute', left: 8, right: 8, bottom: 8, backgroundColor: 'rgba(180,35,24,.92)', paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8, alignItems: 'center' },
  unavailableText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  quantityBadge: { position: 'absolute', left: 8, top: 8, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  quantityBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  body: { padding: 12, minHeight: 112 },
  category: { color: colors.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  name: { color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: 3, minHeight: 38 },
  footer: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  add: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#FFFFFF', fontSize: 18, fontWeight: '500', lineHeight: 20 },
});
