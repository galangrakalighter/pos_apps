import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../theme';
import { Product } from '../types';
import { rupiah } from '../data/mock';

interface Props { product: Product; onAdd: (product: Product) => void; compact?: boolean; showPrice?: boolean; }

export function ProductCard({ product, onAdd, compact, showPrice = true }: Props) {
  const soldOut = product.stock <= 0 || (product.kind === 'produk_jadi' && (product.recipeComplete === false || product.price <= 0));
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
        <View style={styles.stockBadge}><Text style={styles.stockText}>{product.kind === 'produk_jadi' && product.recipeComplete === false ? 'Resep belum lengkap' : `Stok ${product.stock}${product.kind === 'bahan_baku' && product.unit ? ` ${product.unit}` : ''}`}</Text></View>
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
  body: { padding: 12, minHeight: 112 },
  category: { color: colors.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  name: { color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: 3, minHeight: 38 },
  footer: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  add: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#FFFFFF', fontSize: 18, fontWeight: '500', lineHeight: 20 },
});
