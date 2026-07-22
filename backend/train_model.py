from ultralytics import YOLO
import os

def train_building_damage_model():
    print("🚀 开始训练大楼破损检测模型...")
    
    model = YOLO('yolov8n.pt')
    
    print("📝 提示：当前使用预训练模型进行演示。")
    print("💡 如需训练专用模型，请准备标注好的数据集并配置 data.yaml")
    print("\n📦 保存模型到 models/yolov8n.pt")
    
    model.save('models/yolov8n.pt')
    print("✅ 模型准备完成！")
    
    return model

if __name__ == "__main__":
    train_building_damage_model()
