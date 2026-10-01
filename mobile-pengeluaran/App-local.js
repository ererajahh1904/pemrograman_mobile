import { useState } from 'react';
import { View, Text, TextInput, Button, FlatList } from 'react-native';

function Kartu({ item }) {
  return (
    <Text style={{ paddingVertical: 12 }}>
      {item.judul} - Rp {item.nominal}
    </Text>
  );
}

export default function App() {
  const [items, setItems] = useState([
    { id: 1, judul: 'Makan siang', nominal: 20000 },
    { id: 2, judul: 'Bensin', nominal: 15000 },
  ]);

  const [judul, setJudul] = useState('');
  const [nominal, setNominal] = useState('');

  function tambah() {
    if (!judul.trim() || !nominal.trim()) return;

    setItems(old => [
      ...old,
      {
        id: Math.max(0, ...old.map(x => x.id)) + 1,
        judul: judul.trim(),
        nominal: Number(nominal),
      },
    ]);

    setJudul('');
    setNominal('');
  }

  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 60 }}>
      <Text style={{ fontSize: 24 }}>Pengeluaran lokal</Text>

      <TextInput
        value={judul}
        onChangeText={setJudul}
        placeholder="Judul"
        accessibilityLabel="Judul"
        style={{
          borderWidth: 1,
          padding: 12,
          marginVertical: 16,
        }}
      />

      <TextInput
        value={nominal}
        onChangeText={setNominal}
        placeholder="Nominal"
        accessibilityLabel="Nominal"
        keyboardType="numeric"
        style={{
          borderWidth: 1,
          padding: 12,
          marginBottom: 16,
        }}
      />

      <Button title="Tambah Pengeluaran" onPress={tambah} />

      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <Kartu item={item} />}
        ListEmptyComponent={
          <Text>Belum ada pengeluaran.</Text>
        }
      />
    </View>
  );
}