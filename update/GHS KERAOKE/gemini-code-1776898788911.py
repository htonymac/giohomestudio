def full_audio_analysis(audio_path):
    # Extracts the "Voice Flow Profile"
    y, sr = librosa.load(audio_path)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    # Detected Key, BPM, and Energy for Beat Recommendation
    return {"bpm": tempo, "key": keys[chroma.mean(axis=1).argmax()], "energy": librosa.feature.rms(y=y).mean()}