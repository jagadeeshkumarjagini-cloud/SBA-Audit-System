import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function App() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');

  const processBill = async () => {
    // 1. Get Permission & Capture
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert("Permission Error", "Please allow camera access.");

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled) return;

    setLoading(true);
    try {
      // 2. SPEED COMPRESSION (Resize to 800px for faster upload)
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );
      setImage(compressed.uri);

      // 3. FASTER OCR (Direct File Upload)
      let formData = new FormData();
      formData.append('file', {
        uri: compressed.uri,
        name: 'bill.jpg',
        type: 'image/jpeg',
      });
      formData.append('apikey', 'K81234567888957'); 
      formData.append('isTable', 'true'); // Captures columns better
      formData.append('OCREngine', '2'); // Faster Engine

      const res = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const json = await res.json();
      const text = json.ParsedResults[0].ParsedText;

      // 4. Extract Details
      const lines = text.split('\n');
      const dateMatch = text.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);
      const amountMatch = text.match(/(\d+\.\d{2})/);

      setVendor(lines[0]?.trim() || "Manual Entry Required");
      setDate(dateMatch ? dateMatch[0] : "");
      setAmount(amountMatch ? amountMatch[0] : "");

    } catch (e) {
      Alert.alert("Network Error", "Scanning took too long or internet is slow.");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    const html = `
      <html>
        <body style="font-family: Helvetica; padding: 40px;">
          <h1 style="color: #0A192F; text-align: center;">SAI BRUNDAVAN APARTMENTS</h1>
          <h2 style="border-bottom: 1px solid #ccc; padding-bottom: 10px;">Audit Summary</h2>
          <p><strong>Vendor:</strong> ${vendor}</p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Amount:</strong> ₹${amount}</p>
          <div style="page-break-before: always; text-align: center;">
            <h2>ATTACHED BILL</h2>
            <img src="${image}" style="width: 100%; border: 1px solid #000;" />
          </div>
        </body>
      </html>
    `;
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>SBA Audit App</Text>
      
      <TouchableOpacity style={styles.scanBtn} onPress={processBill} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>SCAN BILL</Text>}
      </TouchableOpacity>

      {image && (
        <View style={styles.card}>
          <Text style={styles.label}>Vendor Name</Text>
          <TextInput style={styles.input} value={vendor} onChangeText={setVendor} />
          
          <Text style={styles.label}>Date</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} />
          
          <Text style={styles.label}>Amount (₹)</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" />

          <TouchableOpacity style={styles.pdfBtn} onPress={generatePDF}>
            <Text style={styles.btnText}>GENERATE PDF REPORT</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#0A192F', padding: 25, alignItems: 'center' },
  title: { fontSize: 28, color: '#fff', fontWeight: 'bold', marginVertical: 30 },
  scanBtn: { backgroundColor: '#007AFF', padding: 20, borderRadius: 15, width: '100%', alignItems: 'center' },
  pdfBtn: { backgroundColor: '#28a745', padding: 20, borderRadius: 15, width: '100%', alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  card: { width: '100%', marginTop: 30, backgroundColor: '#fff', padding: 20, borderRadius: 15 },
  label: { color: '#888', fontSize: 12, marginBottom: 5, fontWeight: 'bold' },
  input: { borderBottomWidth: 1, borderBottomColor: '#007AFF', marginBottom: 20, padding: 8, fontSize: 18, color: '#000' }
});
