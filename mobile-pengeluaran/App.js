import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { api } from './src/api';
import { rupiah, tanggalLokal, validate } from './src/helpers';

function formatTanggal(value) {
  const raw = tanggalLokal(value);
  if (raw === '-') return '-';
  const parts = raw.split('/');
  if (parts.length === 3) {
    return `${parts[0]}/${parts[1]}/${String(parts[2]).slice(-2)}`;
  }
  return raw;
}

function PrimaryButton({ title, onPress, disabled = false, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryButton, disabled && styles.disabled, style]}
    >
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function SecondaryButton({ title, onPress, disabled = false, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[styles.secondaryButton, disabled && styles.disabled, style]}
    >
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function ListCard({ item, onPress, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={styles.listCard}
    >
      <Text style={styles.listCardTitle}>{item.judul}</Text>
      <Text style={styles.listCardNominal}>{rupiah(item.nominal)}</Text>
      <Text style={styles.listCardMeta}>{item.kategori || 'Tanpa Kategori'}</Text>
      <Text style={styles.listCardMeta}>{formatTanggal(item.tanggal)}</Text>
      <Text style={styles.listCardLink}>Lihat Detail</Text>
    </Pressable>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [screen, setScreen] = useState('list');
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [judul, setJudul] = useState('');
  const [nominal, setNominal] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [categoryName, setCategoryName] = useState('Tanpa Kategori');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);
  const lock = useRef(false);

  const getCategoryName = (id) => {
    if (id == null) return 'Tanpa Kategori';
    const match = categories.find((item) => item.id === id);
    return match ? match.nama : 'Tidak Diketahui';
  };

  async function loadList({ silent = false } = {}) {
    if (lock.current) return;
    lock.current = true;
    if (!silent) setLoading(true);
    setPageError('');

    try {
      const rows = await api.list();
      if (!Array.isArray(rows)) {
        throw new Error('Daftar harus berupa array');
      }
      setItems(rows);
    } catch (error) {
      setItems([]);
      setPageError('Gagal memuat data');
    } finally {
      lock.current = false;
      setLoading(false);
    }
  }

  async function loadCategories() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setPageError('');
    try {
      const rows = await api.categories();
      if (!Array.isArray(rows)) {
        throw new Error('Kategori harus berupa array');
      }
      setCategories(rows);
      return rows;
    } catch (error) {
      setPageError('Gagal memuat data');
      setScreen('list');
      return [];
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    loadList({ silent: true });
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'list') {
        return false;
      }

      if (screen === 'category') {
        setScreen('create');
        return true;
      }

      if (screen === 'create') {
        setScreen('list');
        setJudul('');
        setNominal('');
        setCategoryId(null);
        setCategoryName('Tanpa Kategori');
        setFormError('');
        return true;
      }

      if (screen === 'edit') {
        setScreen('detail');
        return true;
      }

      if (screen === 'detail') {
        setScreen('list');
        setSelected(null);
        return true;
      }

      if (screen === 'not-found' || screen === 'load-error') {
        setScreen('list');
        return true;
      }

      return false;
    });

    return () => sub.remove();
  }, [screen]);

  async function openCreate() {
    if (lock.current) return;
    const rows = await loadCategories();
    if (!rows.length && categories.length === 0 && pageError) {
      return;
    }

    setJudul('');
    setNominal('');
    setCategoryId(null);
    setCategoryName('Tanpa Kategori');
    setFormError('');
    setScreen('create');
  }

  async function openDetail(id) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setPageError('');
    setFormError('');

    try {
      const row = await api.detail(id);
      setSelected(row);
      setScreen('detail');
    } catch (error) {
      if (error?.status === 404) {
        setSelected(null);
        setScreen('not-found');
        return;
      }
      setPageError('Gagal memuat data');
      setScreen('list');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function openEdit() {
    if (!selected) return;
    setJudul(selected.judul || '');
    setNominal(String(selected.nominal || ''));
    setCategoryId(selected.id_kategori ?? null);
    setCategoryName(getCategoryName(selected.id_kategori));
    setFormError('');
    setScreen('edit');
  }

  async function goToCategory() {
    if (lock.current) return;
    const rows = await loadCategories();
    if (!rows.length && categories.length === 0 && pageError) {
      return;
    }
    setScreen('category');
  }

  async function saveForm() {
    if (lock.current) return;
    const message = validate(judul, nominal);
    if (message) {
      setFormError(message);
      return;
    }

    lock.current = true;
    setBusy(true);
    setFormError('');

    try {
      const payload = {
        judul: judul.trim(),
        nominal: Number(nominal),
      };

      if (screen === 'create') {
        await api.create({
          ...payload,
          id_kategori: categoryId ?? null,
        });
      } else {
        await api.update(selected.id, {
          judul: payload.judul,
          nominal: payload.nominal,
        });
      }

      setJudul('');
      setNominal('');
      setCategoryId(null);
      setCategoryName('Tanpa Kategori');
      setScreen('list');
      await loadList({ silent: false });
    } catch (error) {
      setFormError(error?.message || 'Terjadi kesalahan saat menyimpan data');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!selected || lock.current) return;
    lock.current = true;
    setBusy(true);
    setDeleteModal(false);

    try {
      await api.remove(selected.id);
      setSelected(null);
      setScreen('list');
      await loadList({ silent: false });
    } catch (error) {
      setScreen('detail');
      setFormError(error?.message || 'Terjadi kesalahan saat menghapus data');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function backToList() {
    if (lock.current) return;
    setSelected(null);
    setJudul('');
    setNominal('');
    setCategoryId(null);
    setCategoryName('Tanpa Kategori');
    setFormError('');
    setScreen('list');
  }

  function backFromScreen() {
    if (screen === 'category') {
      setScreen('create');
      return;
    }

    if (screen === 'create') {
      backToList();
      return;
    }

    if (screen === 'edit') {
      setScreen('detail');
      return;
    }

    if (screen === 'detail') {
      backToList();
      return;
    }

    if (screen === 'not-found') {
      backToList();
      return;
    }

    if (screen === 'load-error') {
      backToList();
      return;
    }

    backToList();
  }

  const formDisabled = busy || lock.current;

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {screen === 'list' && (
          <>
            <Text style={styles.screenTitle}>Daftar Pengeluaran</Text>

            {pageError ? (
              <View style={styles.loadErrorBox}>
                <Text style={styles.errorPanelTitle}>Gagal memuat data</Text>
                <Text style={styles.errorPanelMessage}>{`Terjadi Kesalahan Saat\nMengambil Data`}</Text>
                <PrimaryButton title="Coba Lagi" onPress={() => loadList({ silent: false })} />
              </View>
            ) : items.length === 0 ? (
              <>
                <View style={styles.actionRow}>
                  <PrimaryButton title="Tambah Pengeluaran" onPress={openCreate} />
                </View>
                <View style={styles.actionRow}>
                  <PrimaryButton title="Muat Ulang" onPress={() => loadList({ silent: false })} />
                </View>
                <View style={styles.emptyStateWrap}>
                  <Text style={styles.emptyStateText}>Belum ada pengeluaran</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.actionRow}>
                  <PrimaryButton title="Tambah Pengeluaran" onPress={openCreate} />
                </View>
                <View style={styles.actionRow}>
                  <PrimaryButton title="Muat Ulang" onPress={() => loadList({ silent: false })} />
                </View>
                <ScrollView contentContainerStyle={styles.listContainer}>
                  {items.map((item) => (
                    <ListCard
                      key={String(item.id)}
                      item={item}
                      disabled={formDisabled}
                      onPress={() => openDetail(item.id)}
                    />
                  ))}
                </ScrollView>
              </>
            )}
          </>
        )}

        {screen === 'create' && (
          <ScrollView contentContainerStyle={styles.formWrap} keyboardShouldPersistTaps="handled">
            <View style={styles.topActionWrap}>
              <SecondaryButton title="Kembali" onPress={backFromScreen} disabled={formDisabled} />
            </View>

            <Text style={styles.label}>Judul</Text>
            <TextInput
              style={[styles.input, formError && styles.inputError]}
              value={judul}
              onChangeText={(value) => {
                setJudul(value);
                if (formError) setFormError('');
              }}
              editable={!formDisabled}
              placeholder=""
            />
            {formError && (
              <Text style={styles.inlineErrorText}>{formError}</Text>
            )}

            <Text style={styles.label}>Nominal</Text>
            <TextInput
              style={styles.input}
              value={nominal}
              keyboardType="number-pad"
              onChangeText={(value) => {
                setNominal(value);
                if (formError) setFormError('');
              }}
              editable={!formDisabled}
              placeholder=""
            />

            <Text style={styles.label}>Kategori</Text>
            <Pressable style={styles.categoryPicker} onPress={goToCategory} disabled={formDisabled}>
              <Text style={styles.categoryPickerText}>{categoryName}</Text>
            </Pressable>

            <Text style={styles.hintText}>Tanggal otomatis dari server</Text>

            <PrimaryButton
              title={busy ? 'Menyimpan...' : 'Simpan'}
              onPress={saveForm}
              disabled={formDisabled}
              style={styles.submitButton}
            />
          </ScrollView>
        )}

        {screen === 'category' && (
          <View style={styles.fullScreenPanel}>
            <Text style={styles.screenTitle}>Pilih Kategori</Text>
            <View style={styles.categoryList}>
              <Pressable style={styles.categoryItem} onPress={() => { setCategoryId(null); setCategoryName('Tanpa Kategori'); setScreen('create'); }}>
                <Text style={styles.categoryItemText}>Tanpa Kategori</Text>
              </Pressable>
              {categories.map((item) => (
                <Pressable
                  key={String(item.id)}
                  style={styles.categoryItem}
                  onPress={() => {
                    setCategoryId(item.id);
                    setCategoryName(item.nama);
                    setScreen('create');
                  }}
                >
                  <Text style={styles.categoryItemText}>{item.nama}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {screen === 'detail' && selected && (
          <ScrollView contentContainerStyle={styles.formWrap}>
            <Text style={styles.screenTitle}>Detail Pengeluaran</Text>

            <View style={styles.detailBox}>
              <Text style={styles.detailValue}>{selected.judul}</Text>
              <Text style={styles.detailLabel}>Nominal</Text>
              <Text style={styles.detailValue}>{rupiah(selected.nominal)}</Text>
              <Text style={styles.detailLabel}>Tanggal</Text>
              <Text style={styles.detailValue}>{formatTanggal(selected.tanggal)}</Text>
              <Text style={styles.detailLabel}>Id Kategori</Text>
              <Text style={styles.detailValue}>{selected.id_kategori ?? 'Tanpa Kategori'}</Text>
              <Text style={styles.detailLabel}>Kategori</Text>
              <Text style={styles.detailValue}>{getCategoryName(selected.id_kategori)}</Text>
              <Text style={styles.detailLabel}>Catatan</Text>
              <Text style={styles.detailValue}>{selected.catatan || 'Belum Ada Catatan'}</Text>
            </View>

            <PrimaryButton title="Ubah" onPress={openEdit} disabled={formDisabled} style={styles.submitButton} />
            <PrimaryButton title="Hapus" onPress={() => setDeleteModal(true)} disabled={formDisabled} style={styles.submitButton} />
            <SecondaryButton title="Kembali" onPress={backFromScreen} disabled={formDisabled} style={styles.submitButton} />
          </ScrollView>
        )}

        {screen === 'edit' && selected && (
          <ScrollView contentContainerStyle={styles.formWrap} keyboardShouldPersistTaps="handled">
            <View style={styles.topActionWrap}>
              <SecondaryButton title="Kembali" onPress={backFromScreen} disabled={formDisabled} />
            </View>

            <Text style={styles.label}>Judul</Text>
            <TextInput
              style={[styles.input, formError && styles.inputError]}
              value={judul}
              onChangeText={(value) => {
                setJudul(value);
                if (formError) setFormError('');
              }}
              editable={!formDisabled}
            />
            {formError && (
              <Text style={styles.inlineErrorText}>{formError}</Text>
            )}

            <Text style={styles.label}>Nominal</Text>
            <TextInput
              style={styles.input}
              value={nominal}
              keyboardType="number-pad"
              onChangeText={(value) => {
                setNominal(value);
                if (formError) setFormError('');
              }}
              editable={!formDisabled}
            />

            <Text style={styles.label}>Kategori</Text>
            <View style={styles.categoryDisplayBox}>
              <Text style={styles.categoryDisplayText}>{getCategoryName(selected.id_kategori)}</Text>
            </View>

            <Text style={styles.label}>Catatan</Text>
            <View style={styles.categoryDisplayBox}>
              <Text style={styles.categoryDisplayText}>{selected.catatan || 'Belum Ada Catatan'}</Text>
            </View>

            <PrimaryButton
              title={busy ? 'Menyimpan...' : 'Simpan'}
              onPress={saveForm}
              disabled={formDisabled}
              style={styles.submitButton}
            />
          </ScrollView>
        )}

        {screen === 'not-found' && (
          <View style={styles.notFoundWrap}>
            <Text style={styles.screenTitle}>Daftar Pengeluaran</Text>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Data tidak ditemukan</Text>
              <Text style={styles.modalBody}>{`Data Pengeluaran Di\nTemukan`}</Text>
              <PrimaryButton title="Kembali" onPress={backToList} />
            </View>
          </View>
        )}

        {screen === 'load-error' && (
          <View style={styles.notFoundWrap}>
            <Text style={styles.screenTitle}>Daftar Pengeluaran</Text>
            <View style={styles.loadErrorBox}>
              <Text style={styles.errorPanelTitle}>Gagal memuat data</Text>
              <Text style={styles.errorPanelMessage}>{`Terjadi Kesalahan Saat\nMengambil Data`}</Text>
              <PrimaryButton title="Coba Lagi" onPress={() => loadList({ silent: false })} />
            </View>
          </View>
        )}

        <Modal transparent visible={deleteModal} animationType="fade" onRequestClose={() => setDeleteModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>Hapus Pengeluaran?</Text>
              <Text style={styles.confirmMessage}>{`Apakah Anda yakin ingin\nmenghapus Data '${selected?.judul || ''}'?`}</Text>
              <View style={styles.confirmRow}>
                <Pressable style={styles.cancelButton} onPress={() => setDeleteModal(false)}>
                  <Text style={styles.cancelText}>Batal</Text>
                </Pressable>
                <Pressable style={styles.deleteButton} onPress={removeSelected}>
                  <Text style={styles.deleteText}>Hapus</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0F766E" />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: {
    flex: 1,
    backgroundColor: '#F2F4F5',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 4,
  },
  actionRow: {
    marginBottom: 10,
  },
  listContainer: {
    paddingBottom: 20,
  },
  listCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D7DEE3',
    padding: 14,
    marginBottom: 12,
  },
  listCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  listCardNominal: {
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 2,
  },
  listCardMeta: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 2,
  },
  listCardLink: {
    marginTop: 4,
    color: '#0F766E',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#0F8B82',
    borderRadius: 8,
    minHeight: 42,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#DDE7E5',
    borderRadius: 8,
    minHeight: 42,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.55,
  },
  formWrap: {
    paddingBottom: 30,
  },
  topActionWrap: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F5F7F7',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  inputError: {
    borderColor: '#E11D48',
  },
  inlineErrorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 6,
    marginBottom: 4,
  },
  categoryPicker: {
    backgroundColor: '#F5F7F7',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryPickerText: {
    fontSize: 15,
    color: '#111827',
  },
  categoryDisplayBox: {
    backgroundColor: '#F5F7F7',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryDisplayText: {
    fontSize: 15,
    color: '#111827',
  },
  hintText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  submitButton: {
    marginTop: 8,
  },
  fullScreenPanel: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  categoryList: {
    marginTop: 12,
  },
  categoryItem: {
    backgroundColor: '#F5F7F7',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: 10,
  },
  categoryItemText: {
    fontSize: 15,
    color: '#1F2937',
  },
  detailBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D7DEE3',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 10,
    marginBottom: 4,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 15,
    color: '#1F2937',
  },
  emptyStateWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#475569',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBox: {
    width: '84%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  confirmMessage: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 18,
    lineHeight: 20,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginRight: 8,
  },
  cancelText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#0F8B82',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  deleteText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  notFoundWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 30,
  },
  modalBox: {
    width: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  modalBody: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  errorPanelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorPanelMessage: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  loadErrorBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
